import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './routes/Home'

const Spoilers = lazy(() => import('./routes/Spoilers'))

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/spoilers" element={<Spoilers />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
