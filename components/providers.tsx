// ./components/providers.js
'use client'

import { Provider } from 'jotai'
import { PropsWithChildren } from 'react'

const Providers = ({ children }: PropsWithChildren) => {
  return (
    <Provider>
      {children}
    </Provider>
  )
}

export default Providers;


