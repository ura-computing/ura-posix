import { createAuthClient } from "better-auth/react";
import { BACKEND_BASE_URL} from "../constants";

export const authClient = createAuthClient({
  baseURL: `${BACKEND_BASE_URL}auth`,
  user: {
    additionalFields: {
      email: {
        type: "string",
        required: true,
        input: true,
      },
      password: {
        type: "string",
        required: true,
        input: true,
      },
      imageCldPubId: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
});
