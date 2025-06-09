import axios from "axios";
export const createGuestUser = async ({firstName, lastName, email}: {firstName: string, lastName: string, email: string} ) => {
  const response = await axios.post("/api/create-guest-user", { firstName, lastName, email });
  console.log(response.data)
  return response.data;
};
