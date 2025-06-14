import UserData from "@/types/userData"
import axios from "axios"



export const processPayment = async (userData: UserData) => {
    const response = await axios.post("/api/process-payment", userData)
    return response.data
}
