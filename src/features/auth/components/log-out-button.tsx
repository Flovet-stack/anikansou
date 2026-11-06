import { Button } from "@/components/ui/button";

import { logOut } from "../actions";

export function LogOutButton() {
  return (
    <form action={logOut}>
      <Button type="submit" variant="outline">
        Log out
      </Button>
    </form>
  );
}
