import axios from "axios"

export const createTransaction = async ({deposit_price, deposit_charge, buyer_id}: {deposit_price : number, deposit_charge: number, buyer_id: string}) => {
    const response = await axios.post("/api/create-transaction", {deposit_price, deposit_charge, buyer_id})
    console.log(response.data)
    return response.data
}
