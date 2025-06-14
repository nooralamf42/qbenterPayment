import UserData from "@/types/userData"
import { useMutation } from "@tanstack/react-query"
import { processPayment } from "../lib/api/processPayment"

export const useProcessPayment = () => {
    return useMutation({
        mutationFn: (data: UserData) => processPayment(data),
    })
}
