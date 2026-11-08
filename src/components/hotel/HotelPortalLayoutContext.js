import { createContext, useContext } from 'react'

// Prevents child pages from recreating their own sidebar or fullscreen loader.
export const HotelPortalLayoutContext = createContext(null)
export const useHotelPortalLayout = () => useContext(HotelPortalLayoutContext)
