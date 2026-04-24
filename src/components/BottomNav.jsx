import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', label: 'Idag', icon: '🏠' },
  { path: '/kalender', label: 'Kalender', icon: '📅' },
  { path: '/listor', label: 'Listor', icon: '☑️' },
  { path: '/mat', label: 'Mat', icon: '🍽️' },
  { path: '/mer', label: 'Mer', icon: '⚙️' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.path}
          className={`nav-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
