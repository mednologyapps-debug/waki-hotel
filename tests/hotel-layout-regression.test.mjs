import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const shell = read('src/components/hotel/HotelPortalLayout.css')
const layout = read('src/components/hotel/HotelPortalLayout.jsx')
const sidebar = read('src/components/hotel/HotelSidebar.jsx')
const base = read('src/index.css')
const app = read('src/App.jsx')
const dashboard = read('src/pages/HotelDashboardPage.jsx')
const reception = read('src/pages/HotelAvailabilityPage.jsx')

test('fixed sidebar is counted exactly once in the app shell', () => {
  // Original CSS already fixes the sidebar at 250px (220px at tablet).
  assert.match(base, /\.hotel-sidebar--reference\s*\{[\s\S]*?--hotel-sidebar-width:\s*250px/)
  assert.match(base, /\.hotel-dashboard\s*\{\s*width:\s*calc\(100% - 250px\)/)
  // A grid with a fixed sidebar also creates a phantom column and hides
  // the title underneath it; the outer shell must be ordinary block layout.
  assert.match(shell, /\.waki-hotel-app-shell\s*\{display:block;/)
  assert.doesNotMatch(shell, /\.waki-hotel-app-shell\s*\{[^}]*grid-template-columns/)
  assert.match(shell, /\.waki-hotel-app-shell__center\s*\{[^}]*margin-left:250px/)
  // Compensate old page margin: this was the root cause of horizontally
  // clipped KPIs, Reception tables and hotel forms.
  assert.match(shell, /\.waki-hotel-app-shell__viewport \.hotel-dashboard[^\{]*\{[^}]*margin-left:0 !important;/)
})

test('tablet, mobile, and nested hotel portal layout have correct offsets', () => {
  assert.match(shell, /@media\(max-width:1100px\) and \(min-width:851px\)/)
  assert.match(shell, /margin-left:220px/)
  assert.match(shell, /@media\(max-width:850px\)/)
  assert.match(shell, /\.waki-hotel-app-shell__center\{width:100%;max-width:100%;margin-left:0;/)
  assert.match(shell, /\.waki-hotel-app-shell__viewport > \.hotel-portal\{[^}]*padding-top:0 !important;/)
  assert.match(shell, /\.waki-hotel-app-shell__viewport \.hotel-dashboard\.hotel-setup-page/)
  assert.match(shell, /\.waki-hotel-app-shell__viewport \.hotel-reservations-page/)
})

test('sidebar is persistent and not duplicated within nested page routes', () => {
  assert.match(app, /<Route element=\{<HotelPortalLayout\s*\/>\}>/)
  assert.match(layout, /<HotelSidebarContents/)
  assert.match(layout, /<Outlet\s*\/>/)
  assert.match(sidebar, /if \(layout\?\.embedded\) return null/)
  assert.match(dashboard, /<HotelSidebar/)
  assert.match(reception, /<HotelSidebar/)
  assert.match(shell, /\.waki-hotel-app-shell__viewport \.hotel-dashboard-grid/)
})

test('original KPI and Reception designs remain intact', () => {
  assert.match(base, /\.hotel-kpi-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(/)
  assert.match(base, /\.hotel-dashboard-grid\s*\{[\s\S]*?grid-template-columns:/)
  assert.match(reception, /className="hotel-dashboard hotel-ops availability-page"/)
  assert.match(layout, /waki-hotel-app-shell__status/)
})
