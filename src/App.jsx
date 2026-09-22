import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom'

import './App.css'

import ProtectedHotelRoute
  from './components/ProtectedHotelRoute'

import HotelReservationDetailPage
  from './pages/HotelReservationDetailPage'

import WakiLoaderDemoPage
  from './pages/WakiLoaderDemoPage'

import HotelRoomUnitsPage
  from './pages/HotelRoomUnitsPage'

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


function ProtectedPage({
  children
}) {
  return (
    <ProtectedHotelRoute>
      {children}
    </ProtectedHotelRoute>
  )
}


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
          DEMO TEMPORAL DEL LOADER
          ===================================================== */}

      <Route
        path="/loader-video"
        element={
          <WakiLoaderDemoPage />
        }
      />


      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedPage>
            <HotelDashboardPage />
          </ProtectedPage>
        }
      />


      {/* =====================================================
          RESERVAS
          ===================================================== */}

      <Route
        path="/reservas"
        element={
          <ProtectedPage>
            <HotelReservationsPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/reservas/:reservationId"
        element={
          <ProtectedPage>
            <HotelReservationDetailPage />
          </ProtectedPage>
        }
      />


      {/* =====================================================
          HABITACIONES
          ===================================================== */}

      <Route
        path="/habitaciones"
        element={
          <ProtectedPage>
            <HotelRoomsPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/habitaciones/nueva"
        element={
          <ProtectedPage>
            <HotelRoomCreatePage />
          </ProtectedPage>
        }
      />


      <Route
        path="/habitaciones/:roomId/unidades"
        element={
          <ProtectedPage>
            <HotelRoomUnitsPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/habitaciones/:roomId/editar"
        element={
          <ProtectedPage>
            <HotelRoomEditPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/habitaciones/:roomId/fotos"
        element={
          <ProtectedPage>
            <HotelRoomPhotosPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/habitaciones/:roomId"
        element={
          <ProtectedPage>
            <HotelRoomDetailPage />
          </ProtectedPage>
        }
      />


      {/* =====================================================
          TARIFAS
          ===================================================== */}

      <Route
        path="/tarifas"
        element={
          <ProtectedPage>
            <HotelRatesPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/tarifas/nueva"
        element={
          <ProtectedPage>
            <HotelRateCreatePage />
          </ProtectedPage>
        }
      />


      <Route
        path="/tarifas/:rateId/editar"
        element={
          <ProtectedPage>
            <HotelRateEditPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas"
        element={
          <ProtectedPage>
            <HotelRateRulesPage />
          </ProtectedPage>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas/nueva"
        element={
          <ProtectedPage>

            <HotelRateRuleFormPage
              mode="create"
            />

          </ProtectedPage>
        }
      />


      <Route
        path="/tarifas/:rateId/reglas/:ruleId/editar"
        element={
          <ProtectedPage>

            <HotelRateRuleFormPage
              mode="edit"
            />

          </ProtectedPage>
        }
      />


      {/* =====================================================
          MI HOTEL
          ===================================================== */}

      <Route
        path="/mi-hotel"
        element={
          <ProtectedPage>
            <HotelProfilePage />
          </ProtectedPage>
        }
      />


      <Route
        path="/mi-hotel/revision"
        element={
          <ProtectedPage>
            <HotelReviewPage />
          </ProtectedPage>
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
