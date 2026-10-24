import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { gql } from "./graphql";
import { ME, type Me } from "./queries";

// Data Access Layer: every dashboard page and the user menu go through this. It is the
// authorization check; the UI never decides who is an admin.
//
// `cache` memoizes per request, so the page and the header can both call it and only one
// `me` query is sent.
export const getAdmin = cache(async (): Promise<Me> => {
  const { me } = await gql<{ me: Me }>(ME);
  if (me.role !== "ADMIN") {
    // A rep's token (or a hand-made cookie) got this far. Drop the session and say why.
    redirect("/auth/expired?reason=forbidden");
  }
  return me;
});
