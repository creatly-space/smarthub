export default function Header() {
  const now = new Date()
  const days = ['S\u00f6ndag','M\u00e5ndag','Tisdag','Onsdag','Torsdag','Fredag','L\u00f6rdag']
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-day">{days[now.getDay()]}</span>
        <span className="header-date">{now.getDate()} {months[now.getMonth()]}</span>
      </div>
      <div className="header-right">
        <span className="header-greeting">SmartHub</span>
      </div>
    </header>
  )
}
