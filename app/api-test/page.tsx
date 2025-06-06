'use client'

import React from 'react'

const page = () => {
    const getData = async() =>{
        const res = await fetch('/api/create-guest-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'email': 'bert.gray@mail.com',
              'first_name': 'Bert',
              'last_name': 'Gray',
              'country_code': 'us',
            }),
          });
          const data = await res.json();
          console.log(data)
    }
  return (
    <div>
      <button onClick={getData}>click me to call api</button>
    </div>
  )
}

export default page