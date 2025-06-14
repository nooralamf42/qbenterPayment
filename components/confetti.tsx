'use client'

import useWindowSize from '@/app/hooks/useWindowSize';
import React from 'react'
import Confetti from 'react-confetti'

export default () => {
    const {width, height} = useWindowSize();
  return (
    <Confetti
    width={width}
    height={height}
    />
  )
}