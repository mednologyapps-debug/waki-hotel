import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom'

import HotelReservationDetailPage
  from './pages/HotelReservationDetailPage'

import HotelRoomUnitsPage
  from './pages/HotelRoomUnitsPage'

import './App.css'

import ProtectedHotelRoute
  from './components/ProtectedHotelRoute'

import HotelReservationsPage
  from './pages/HotelReservationsPage'

import HotelLoginPage
  from './pages/HotelLoginPage'

import HotelDashboardPage
  from './pages/HotelDashboardPage'

import HotelRoomsPage
  from './pages/HotelRoomsPage'

import HotelRoomCreatePage
  from './pages/HotelRoomCreatePage'

import HotelRoomDetailPage
  from './pages/HotelRoomDetailPage'

import HotelRoomEditPage
  from './pages/HotelRoomEditPage'

import HotelRoomPhotosPage
  from './pages/HotelRoomPhotosPage'

import HotelRatesPage
  from './pages/HotelRatesPage'

import HotelRateCreatePage
  from './pages/HotelRateCreatePage'

import HotelRateEditPage
  from './pages/HotelRateEditPage'

import HotelRateRulesPage
  from './pages/HotelRateRulesPage'

import HotelRateRuleFormPage
  from './pages/HotelRateRuleFormPage'

import HotelProfilePage
  from './pages/HotelProfilePage'

import HotelReviewPage
  from './pages/HotelReviewPage'


export default function App() {
  return (
    <Routes>


      {/* =====================================================
          INICIO
          ===================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
  path="/habitaciones/:roomId/unidades"
  element={
    <HotelRoomUnitsPage />
  }
/>

      <Route
  path="/reservas"
  element={
    <HotelReservationsPage />
  }
/>

<Route
  path="/reservas/:reservationId"
  element={
    <HotelReservationDetailPage />
  }
/>


      {/* =====================================================
          LOGIN
          ===================================================== */}

      <Route
        path="/login"
        element={
          <HotelLoginPage />
        }
      />


      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedHotelRoute>

            <HotelDashboardPage />

          </ProtectedHotelRoute>
        }
      />


      {/* =====================================================
          HABITACIONES
          ===================================================== */}

      <Route
        path="/habitaciones"
        element={
          <ProtectedHotelRoute>

            <HotelRoomsPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/habitaciones/nueva"
        element={
          <ProtectedHotelRoute>

            <HotelRoomCreatePage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/habitaciones/:roomId/editar"
        element={
          <ProtectedHotelRoute>

            <HotelRoomEditPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/habitaciones/:roomId/fotos"
        element={
          <ProtectedHotelRoute>

            <HotelRoomPhotosPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/habitaciones/:roomId"
        element={
          <ProtectedHotelRoute>

            <HotelRoomDetailPage />

          </ProtectedHotelRoute>
        }
      />


      {/* =====================================================
          TARIFAS
          ===================================================== */}

      <Route
        path="/tarifas"
        element={
          <ProtectedHotelRoute>

            <HotelRatesPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/tarifas/nueva"
        element={
          <ProtectedHotelRoute>

            <HotelRateCreatePage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/tarifas/:rateId/editar"
        element={
          <ProtectedHotelRoute>

            <HotelRateEditPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas"
        element={
          <ProtectedHotelRoute>

            <HotelRateRulesPage />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas/nueva"
        element={
          <ProtectedHotelRoute>

            <HotelRateRuleFormPage
              mode="create"
            />

          </ProtectedHotelRoute>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas/:ruleId/editar"
        element={
          <ProtectedHotelRoute>

            <HotelRateRuleFormPage
              mode="edit"
            />

          </ProtectedHotelRoute>
        }
      />


      {/* =====================================================
          MI HOTEL
          ===================================================== */}

      <Route
        path="/mi-hotel"
        element={
          <ProtectedHotelRoute>

            <HotelProfilePage />

          </ProtectedHotelRoute>
        }
      />


      {/* =====================================================
          REVISIÓN FINAL
          ===================================================== */}

      <Route
        path="/mi-hotel/revision"
        element={
          <ProtectedHotelRoute>

            <HotelReviewPage />

          </ProtectedHotelRoute>
        }
      />


      {/* =====================================================
          FALLBACK
          ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />


    </Routes>
  )
}