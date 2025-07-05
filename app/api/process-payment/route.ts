// app/api/create-guest-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = 'https://api.authorize.net/xml/v1/request.api';
const AUTH_KEY = process.env.AUTHORIZE_TRANSACTION_KEY as string;
const LOGIN_ID = process.env.AUTHORIZE_API_LOGIN_ID as string;
export async function POST(req: NextRequest) {
  const clientIp =
  req.headers.get('x-forwarded-for')?.replaceAll('::ffff:', '') || '0.0.0.0';
  const { firstName, lastName, company, address, city, state, zip, product_id, amount, product_description, cardNumber, cardExpirationDate, cardCode } = await req.json();
  const payload =
  {
    "createTransactionRequest": {
      "merchantAuthentication": {
        "name": LOGIN_ID,
        "transactionKey": AUTH_KEY
      },
      "transactionRequest": {
        "transactionType": "authCaptureTransaction",
        "amount": amount,
        "payment": {
          "creditCard": {
            "cardNumber": cardNumber,
            "expirationDate": cardExpirationDate,
            "cardCode": cardCode
          }
        },
        "lineItems": {
          "lineItem": {
            "itemId": product_id,
            "name": `QuickBooks ${product_id} Edition`,
            "description": product_description,
            "quantity": '1',
            "unitPrice": amount
          }
        },
        "billTo": {
          "firstName": firstName,
          "lastName": lastName,
          "company": company,
          "address": address,
          "city": city,
          "state": state,
          "zip": zip,
        },
        "customerIP": clientIp,
        "processingOptions": {
          "isSubsequentAuth": "true"        
        },
        "authorizationIndicatorType": {
          "authorizationIndicator": "final"
        }
      }
    }
  }

  try {
    const response = await axios.post(API_URL, JSON.stringify(payload));
    console.log(response)
    if(response.data.transactionResponse.responseCode !== '1') {
      const errorMessege = response.data.transactionResponse.errors[0].errorText
      return NextResponse.json(
        {
          message: 'Failed to create transaction',
          error: errorMessege || "Something went wrong",
        },
        { status: 500 }
      );
    } 
    console.log(response.data)
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json(
      {
        message: 'Failed to create transaction',
        error: error.response?.data || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }

}
