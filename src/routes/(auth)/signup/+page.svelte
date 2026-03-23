<script lang="ts">
 import { Button } from "$lib/components/ui/button/index.js";
 import { Label } from "$lib/components/ui/label/index.js";
 import { Input } from "$lib/components/ui/input/index.js";
 import * as Card from "$lib/components/ui/card/index.js";
    import { goto } from "$app/navigation";
</script>
 
<Card.Root class="-my-4 w-full max-w-sm">
 <Card.Header>
  <Card.Title>Create your account</Card.Title>
  <Card.Description
   >Enter your email below to create your account</Card.Description
  >
  <Card.Action>
   <Button variant="link" onclick={() => {goto("/login")}}>Login</Button>
  </Card.Action>
 </Card.Header>
 <Card.Content>
  <form>
   <div class="flex flex-col gap-6">
    <div class="grid gap-2">
     <Label for="username">Username</Label>
     <Input id="username" type="text" placeholder="Alice" required />
    </div>
    <div class="grid gap-2">
     <Label for="email">Email</Label>
     <Input id="email" type="email" placeholder="test@gmail.com" required />
    </div>
    <div class="grid gap-2">
     <div class="flex items-center">
      <Label for="password">Password</Label>
      <a
       href="##"
       class="ms-auto inline-block text-sm underline-offset-4 hover:underline"
      >
       Forgot your password?
      </a>
     </div>
     <Input id="password" type="password" placeholder="●●●●●●●●" required />
    </div>
   </div>
  </form>
 </Card.Content>
 <Card.Footer class="flex-col gap-2">
  <Button type="submit" class="w-full">Create Account</Button>
 </Card.Footer>
</Card.Root>

