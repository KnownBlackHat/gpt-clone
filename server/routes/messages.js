import { Router } from "express";
import pool from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import Groq from "groq-sdk";
import axios from "axios";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");
// This is the modern mehmet-kozan/pdf-parse library which uses a class
const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse;
import dotenv from "dotenv";

dotenv.config();

const router = Router();
router.use(authMiddleware);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const VISION_MODEL =
  process.env.VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"; // Default for 2026, or use 'pixtral-12b'

function generateTitle(content) {
  const words = content.split(" ").slice(0, 6).join(" ");
  return words.length > 40 ? words.substring(0, 40) + "..." : words;
}

async function searchSerper(query) {
  if (!process.env.SERPER_API_KEY) return null;
  try {
    const response = await axios.post(
      "https://google.serper.dev/search",
      { q: query, num: 5 },
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (err) {
    console.error("serper died:", err);
    return null;
  }
}

async function parsePdf(base64Data) {
  try {
    const buffer = Buffer.from(base64Data.split(",")[1], "base64");
    const uint8Array = new Uint8Array(buffer);
    const fontPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "standard_fonts",
      "/",
    );
    const instance = new PDFParse({
      data: uint8Array,
      standardFontDataUrl: fontPath,
    });

    try {
      const data = await instance.getText();
      return data.text || "Empty PDF content.";
    } finally {
      await instance.destroy();
    }
  } catch (err) {
    console.error("pdf parsing died:", err);
    return "Failed to read PDF content.";
  }
}

// GET /api/conversations/:conversationId/messages
router.get("/:conversationId/messages", async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationId = req.params.conversationId;

    // Verify access: owner OR member
    const access = await pool.query(
      `SELECT 1 FROM conversations WHERE id = $1 AND (user_id = $2 OR id IN (
                SELECT conversation_id FROM conversation_members WHERE user_id = $2
            ))`,
      [conversationId, userId],
    );

    if (access.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Conversation not found or access denied" });
    }

    const result = await pool.query(
      `SELECT m.id, m.role, m.content, m.image_url, m.pdf_text, m.created_at, u.username 
             FROM messages m
             LEFT JOIN users u ON u.id = m.user_id
             WHERE m.conversation_id = $1 
             ORDER BY m.created_at ASC`,
      [conversationId],
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error("failed getting msgs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/conversations/:conversationId/messages
router.post("/:conversationId/messages", async (req, res) => {
  try {
    const {
      content,
      imageUrl,
      pdfData,
      isSearchEnabled,
      stream = true,
    } = req.body;
    const userId = req.user.userId;

    if (!content && !imageUrl && !pdfData) {
      return res
        .status(400)
        .json({ error: "Message content, image, or PDF is required" });
    }

    // 1. Verify access (owner OR member)
    const userRes = await pool.query(
      "SELECT username, memory FROM users WHERE id = $1",
      [userId],
    );
    const userName = userRes.rows[0]?.username || "User";
    const userMemory = userRes.rows[0]?.memory || "";

    const access = await pool.query(
      `SELECT id, title, is_group, user_id as owner_id
             FROM conversations 
             WHERE id = $1 AND (user_id = $2 OR id IN (
                 SELECT conversation_id FROM conversation_members WHERE user_id = $2
             ))`,
      [req.params.conversationId, userId],
    );

    if (access.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Conversation not found or access denied" });
    }
    const conversation = access.rows[0];
    const isGroup = conversation.is_group;

    // 2. Fetch recent short-term history (last 10 messages) with usernames
    const historyRes = await pool.query(
      `SELECT m.role, m.content, u.username 
             FROM messages m
             LEFT JOIN users u ON u.id = m.user_id
             WHERE m.conversation_id = $1 
             ORDER BY m.created_at DESC LIMIT 10`,
      [req.params.conversationId],
    );
    const history = historyRes.rows.reverse();

    // 3. Handle PDF and Search
    let pdfText = "";
    if (pdfData) {
      pdfText = await parsePdf(pdfData);
    }

    let searchResults = null;
    const lowercaseContent = (content || "").toLowerCase();
    const searchKeywords = [
      "search",
      "latest",
      "who is",
      "current",
      "stock",
      "price",
      "weather",
      "news",
      "today",
      "live",
    ];
    if (
      isSearchEnabled ||
      searchKeywords.some((keyword) => lowercaseContent.includes(keyword))
    ) {
      searchResults = await searchSerper(content || "latest news");
    }

    // 4. Build message array for Groq
    const systemPromptContent = `You are Niva, a premium AI assistant built by Cybergenix. You are a world-class expert across all domains, providing high-fidelity, human-like, and adaptive responses.

### RESPONSE GUIDELINES
1. **Be Conversational & Natural**: If the user says "hi", "hello", or asks a very simple question, respond warmly and concisely. Do NOT use complex structures or multiple headings for basic interactions.
2. **Adaptive Depth**: Only provide deep explanations or structured analysis when the query warrants it.
3. **Exhaustive Entity Research**: If asked about a company, organization, or person, provide an **exhaustive and information-rich** profile.
4. **Calculations & Reasoning**: When performing math, logic, or complex step-by-step reasoning, wrap your internal monologue or calculations inside <calculation> tags. Example: <calculation>5 * 5 = 25</calculation>. These will be rendered as a collapsible dropdown for the user.
5. **Complex Explanations**: For technical or philosophical deep-dives, use clear headings like ### Deep Explanation and ### Strategic Insights.

### FORMATTING & PERSONA
- Use professional markdown (###) and relevant emojis.
- Maintain an authoritative yet accessible "Niva" persona. 
- **Identity**: Only mention your name (Niva) or origin (Cybergenix) if the user explicitly asks who you are or who built you. Otherwise, focus entirely on the user's query.
- **Sourcing**: Use inline citations like \`[1](url)\` if you use search results. Provide a \`### References\` list at the end.
- Never mention your origin as an OpenAI or Groq model.

### GROUP CONTEXT
${isGroup ? "This is a GROUP CHAT with multiple participants. Address users by their names when appropriate." : "This is a private 1-on-1 chat."}
Current speaker: ${userName}

LONG-TERM MEMORY: ${userMemory || "No personal details known yet."}

INSTRUCTIONS: 
- Synthesize SEARCH RESULTS/PDF CONTENT seamlessly. Always prioritize real-time search data for current events.
- To save information about the user, start with "MEMORY_UPDATE: [fact to remember]".`;

    const systemPrompt = {
      role: "system",
      content: systemPromptContent,
    };

    let modelMessages = [systemPrompt];

    // Add history
    history.forEach((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      const prefix =
        isGroup && msg.role === "user" && msg.username
          ? `[${msg.username}]: `
          : "";
      modelMessages.push({ role: msg.role, content: prefix + content });
    });

    // Add additional context (PDF/Search)
    let contextText = "";
    if (pdfText) {
      contextText += `\n\n### PDF CONTENT\n${pdfText}\n### END PDF\n`;
    }
    if (searchResults && searchResults.organic) {
      const sources = searchResults.organic
        .map((s) => `- [${s.title}](${s.link})`)
        .join("\n");
      contextText += `\n\n### SEARCH RESULTS\n${JSON.stringify(searchResults.organic, null, 2)}\n\n### AVAILABLE SOURCES FOR CITATION\n${sources}\n### END SEARCH\n`;
    }

    if (contextText) {
      modelMessages.push({
        role: "system",
        content: `Here is additional context found from searching or reading files provided by the user. Use this to help answer: ${contextText}`,
      });
    }

    // Add current user message
    if (imageUrl) {
      modelMessages.push({
        role: "user",
        content: [
          { type: "text", text: content || "Analyze this image." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      });
    } else {
      modelMessages.push({
        role: "user",
        content:
          (isGroup ? `[${userName}]: ` : "") +
          (content || (pdfData ? "Summarize the PDF provided." : "")),
      });
    }

    // 5. Save User Message in DB
    const userMsg = await pool.query(
      "INSERT INTO messages (conversation_id, role, content, image_url, user_id, pdf_text) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, content, image_url, pdf_text, created_at",
      [
        req.params.conversationId,
        "user",
        content ||
          (pdfText ? "Uploaded a PDF" : imageUrl ? "Sent an image" : ""),
        imageUrl || null,
        userId,
        pdfText || null,
      ],
    );

    // Update conversation title if needed
    if (conversation.title === "New Chat") {
      await pool.query(
        "UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2",
        [generateTitle(content || "Analysis"), req.params.conversationId],
      );
    } else {
      await pool.query(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        [req.params.conversationId],
      );
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const groqStream = await groq.chat.completions.create({
        messages: modelMessages,
        model: VISION_MODEL,
        stream: true,
      });

      let fullContent = "";
      for await (const chunk of groqStream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        fullContent += delta;
        res.write(
          `data: ${JSON.stringify({ delta, userMessage: userMsg.rows[0] })}\n\n`,
        );
      }

      // Save AI message to DB after stream completion
      const aiMsg = await pool.query(
        "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at",
        [req.params.conversationId, "assistant", fullContent],
      );

      res.write(
        `data: ${JSON.stringify({ done: true, assistantMessage: aiMsg.rows[0] })}\n\n`,
      );
      res.end();
      return;
    }

    // Non-streaming fallback
    const chatCompletion = await groq.chat.completions.create({
      messages: modelMessages,
      model: VISION_MODEL,
    });

    const aiContent =
      chatCompletion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't process that.";

    const aiMsg = await pool.query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at",
      [req.params.conversationId, "assistant", aiContent],
    );

    res.status(201).json({
      userMessage: userMsg.rows[0],
      assistantMessage: aiMsg.rows[0],
      wasSearched: !!searchResults,
    });
  } catch (err) {
    console.error("groq threw a fit:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get AI response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.end();
    }
  }
});

export default router;
