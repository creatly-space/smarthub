import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import Idag from './pages/Idag'
import Kalender from './pages/Kalender'
import Listor from './pages/Listor'
import Mat from './pages/Mat'
import Mer from './pages/Mer'
import './styles/global.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Idag />} />
            <Route path="/kalender" element={<Kalender />} />
            <Route path="/listor" element={<Listor />} />
            <Route path="/mat" element={<Mat />} />
            <Route path="/mer" element={<Mer />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
