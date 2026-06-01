import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Cpu, LogOut, Grid, Cpu as CpuIcon, Layers, Database, Fan, Zap, HardDrive, Info, Settings as SettingsIcon, BarChart2, Gauge, Trash2, Globe, Gamepad, Menu, X, ChevronLeft, ChevronRight, DownloadCloud, Activity } from 'lucide-react'

export function Layout({ user, onLogout }: { user: any; onLogout: () => void }) {
  const location = useLocation()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [menuOpen, setMenuOpen] = useState(false)

  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 850 && window.innerWidth >= 550)

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setWindowWidth(width)
      // Auto-collapse based on resolution threshold
      if (width < 850 && width >= 550) {
        setIsCollapsed(true)
      } else if (width >= 850) {
        setIsCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = windowWidth < 550

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      await window.api.auth.logout(token)
    }
    localStorage.removeItem('auth_token')
    onLogout()
  }

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/software', label: 'Oprogramowanie', icon: <Package size={20} /> },
    { to: '/multi-installer', label: 'Szybki Instalator', icon: <DownloadCloud size={20} /> },
    { to: '/hardware', label: 'Sprzęt', icon: <Cpu size={20} />, subLinks: true },
    { to: '/performance', label: 'Wydajność', icon: <BarChart2 size={20} /> },
    { to: '/optimizer', label: 'Optymalizator', icon: <Gauge size={20} /> },
    { to: '/bloatware', label: 'Bloatware', icon: <Trash2 size={20} /> },
    { to: '/network', label: 'Sieć', icon: <Globe size={20} /> },
    { to: '/peripherals', label: 'Urządzenia', icon: <Gamepad size={20} /> },
    { to: '/backup', label: 'Kopia zapasowa', icon: <Database size={20} /> },
    { to: '/diagnostics', label: 'Diagnostyka', icon: <Activity size={20} /> },
    { to: '/settings', label: 'Ustawienia', icon: <SettingsIcon size={20} /> }
  ]

  return (
    <div className={isMobile ? 'flex flex-col' : 'flex'} style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Mobile Top Header */}
      {isMobile && (
        <header className="mobile-header glass-panel">
          <div className="flex items-center gap-md">
            <div style={{ width: '32px', height: '32px', background: 'var(--color-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px var(--color-primary-glow)' }}>
              <span style={{ color: 'var(--color-bg-main)', fontWeight: 'bold', fontSize: '16px' }}>U</span>
            </div>
            <h2 className="text-gradient" style={{ margin: 0, fontSize: '18px' }}>UpdaterWin</h2>
          </div>
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>
      )}

      {/* Mobile Overlay Menu */}
      {isMobile && menuOpen && (
        <div className="mobile-menu-overlay glass-panel">
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '15px' }}>
                {user.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{user.name || 'Administrator'}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{user.email}</div>
              </div>
            </div>
          )}
          <nav className="mobile-nav flex-col gap-sm">
            {navLinks.map((link) => (
              <Link 
                key={link.to} 
                to={link.to} 
                className={`nav-link ${isActive(link.to) || (link.to !== '/' && location.pathname.startsWith(link.to)) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
            <button className="nav-link w-100" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: '20px' }} onClick={() => { setMenuOpen(false); handleLogout(); }}>
              <LogOut size={20} />
              <span>Wyloguj</span>
            </button>
          </nav>
        </div>
      )}

      {/* Sidebar Desktop/Tablet */}
      {!isMobile && (
        <aside className="glass-panel" style={{ 
          width: isCollapsed ? '80px' : '280px', 
          margin: '16px', 
          padding: isCollapsed ? '24px 8px' : '24px', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'width var(--transition-normal), padding var(--transition-normal)'
        }}>
          <div className="flex items-center gap-md" style={{ marginBottom: isCollapsed ? '24px' : '40px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--color-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px var(--color-primary-glow)' }}>
              <span style={{ color: 'var(--color-bg-main)', fontWeight: 'bold', fontSize: '20px' }}>U</span>
            </div>
            {!isCollapsed && <h2 className="text-gradient" style={{ margin: 0 }}>UpdaterWin</h2>}
          </div>

          {!isCollapsed && user && (
            <div className="glass-panel" style={{ padding: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '14px', flexShrink: 0 }}>
                {user.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '13px', lineHeight: 1.2 }}>{user.name || 'Administrator'}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{user.email}</div>
              </div>
            </div>
          )}

          <nav className="flex-col gap-sm" style={{ flex: 1, display: 'flex', alignItems: isCollapsed ? 'center' : 'stretch' }}>
            {navLinks.map((link) => {
              const active = isActive(link.to) || (link.to !== '/' && location.pathname.startsWith(link.to))
              return (
                <div key={link.to} style={{ width: '100%' }}>
                  <Link 
                    to={link.to} 
                    className={`nav-link ${active ? 'active' : ''}`}
                    title={isCollapsed ? link.label : undefined}
                    style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '12px' : '12px 16px' }}
                  >
                    {link.icon}
                    {!isCollapsed && <span>{link.label}</span>}
                  </Link>

                  {/* Submenu for Hardware - only shown when expanded */}
                  {!isCollapsed && link.subLinks && location.pathname.startsWith('/hardware') && (
                    <div className="submenu-container">
                      <HardwareSubLink icon={<Grid size={14} />} label="Podsumowanie" tab="summary" />
                      <HardwareSubLink icon={<CpuIcon size={14} />} label="Procesor" tab="cpu" />
                      <HardwareSubLink icon={<Layers size={14} />} label="Płyta Główna" tab="mobo" />
                      <HardwareSubLink icon={<Database size={14} />} label="Pamięć RAM" tab="ram" />
                      <HardwareSubLink icon={<Fan size={14} />} label="Chłodzenie" tab="cooling" />
                      <HardwareSubLink icon={<Zap size={14} />} label="Grafika" tab="gpu" />
                      <HardwareSubLink icon={<HardDrive size={14} />} label="Dyski" tab="disks" />
                      <HardwareSubLink icon={<Globe size={14} />} label="Sieć" tab="network" />
                      <HardwareSubLink icon={<Info size={14} />} label="System" tab="system" />
                      <HardwareSubLink icon={<Gauge size={14} />} label="Benchmark" tab="benchmark" />
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div style={{ 
            marginTop: 'auto', 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            alignItems: isCollapsed ? 'center' : 'stretch' 
          }}>
            <button 
              className="nav-link w-100" 
              style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '12px' : '12px 16px' }} 
              onClick={handleLogout}
              title={isCollapsed ? 'Wyloguj' : undefined}
            >
              <LogOut size={20} />
              {!isCollapsed && <span>Wyloguj</span>}
            </button>

            {/* Toggle Sidebar Button */}
            <button
              className="sidebar-toggle-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Rozwiń pasek boczny' : 'Zwiń pasek boczny'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: isCollapsed ? '12px' : '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-normal)',
                width: '100%',
                outline: 'none'
              }}
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              {!isCollapsed && <span>Zwiń menu</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '32px 32px 32px 16px', 
        overflowY: 'auto',
        marginTop: isMobile ? '80px' : '0',
        height: isMobile ? 'calc(100vh - 80px)' : '100vh',
        boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          <Outlet context={{ user }} />
        </div>
      </main>

      {/* CSS for sidebar links and mobile elements */}
      <style>{`
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--border-radius-sm);
          color: var(--color-text-secondary);
          transition: all var(--transition-normal);
          font-weight: 500;
        }
        .nav-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-primary);
        }
        .nav-link.active {
          background: rgba(69, 243, 255, 0.1);
          color: var(--color-primary);
          border-left: 3px solid var(--color-primary);
        }
        .submenu-container {
          margin-left: 32px;
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          padding-left: 12px;
        }
        .sub-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--color-text-muted);
          border-radius: 6px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .sub-link:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.03);
        }
        .sub-link.active {
          color: var(--color-primary);
          font-weight: 600;
          background: rgba(69, 243, 255, 0.05);
        }
        .sidebar-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: var(--color-text-primary) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Mobile specific styles */
        .mobile-header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 64px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 100;
          box-sizing: border-box;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0;
        }
        .hamburger-btn {
          background: transparent;
          border: none;
          color: var(--color-text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .hamburger-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .mobile-menu-overlay {
          position: fixed;
          top: 64px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 64px);
          z-index: 99;
          padding: 24px;
          box-sizing: border-box;
          border-radius: 0;
          border: none;
          overflow-y: auto;
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        @keyframes slideDown {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )

  function HardwareSubLink({ icon, label, tab }: { icon: any, label: string, tab: string }) {
    const navigate = useNavigate()
    const searchParams = new URLSearchParams(location.search)
    const currentTab = searchParams.get('tab') || 'summary'
    const active = currentTab === tab

    return (
      <div 
        className={`sub-link ${active ? 'active' : ''}`}
        onClick={() => navigate(`/hardware?tab=${tab}`)}
      >
        {icon}
        <span>{label}</span>
      </div>
    )
  }
}
