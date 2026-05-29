import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Shield,
  Globe,
  Award,
  FileText,
  Server,
  Clock,
  DownloadCloud,
  AlertCircle,
  ShieldAlert,
  ExternalLink,
  X,
  RefreshCw,
  CheckCircle,
  Pencil,
  Save,
  Trash2,
  ImageOff,
  Link,
  Plus,
  Image,
  Star
} from 'lucide-react'
import { AppIcon } from '../components/AppIcon'
import { RichEditor } from '../components/RichEditor'
import { DownloadFailModal } from '../components/DownloadFailModal'

export function AppDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [appDetails, setAppDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const [uacMode, setUacMode] = useState(false)
  const [elevating, setElevating] = useState(false)
  // Screenshoty (MS Store)
  const [screenshots, setScreenshots] = useState<string[]>([])
  // Tryb edycji (panel admina)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editIconUrl, setEditIconUrl] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [customization, setCustomization] = useState<any>(null)
  const [savingCustom, setSavingCustom] = useState(false)
  const [editScreenshots, setEditScreenshots] = useState<string[]>([])
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'preflight' | 'downloading'>('idle')
  const [isFailModalOpen, setIsFailModalOpen] = useState(false)
  const [preflightResult, setPreflightResult] = useState<any>(null)

  const [editRating, setEditRating] = useState<number | null>(null)
  const [editReview, setEditReview] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editCategory, setEditCategory] = useState('')
  const [newTagInput, setNewTagInput] = useState('')

  const handleAddTag = () => {
    const trimmed = newTagInput.trim()
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags((prev) => [...prev, trimmed])
      setNewTagInput('')
    }
  }

  const displayTags = Array.from(
    new Set([...(appDetails?.tags || []), ...(customization?.tags || [])])
  )

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // 1. Pobierz podstawowe dane zainstalowanych aplikacji, aby poznać wersje lokalne
        const installedRes = await window.api.getInstalledApps()
        let found: any = null
        if (installedRes.success) {
          found = installedRes.data.find((a: any) => a.id === id)
        }

        // 2. Pobierz zaawansowane metadane z API winget.run za pośrednictwem IPC
        const richRes = await window.api.getWingetRunDetails(id || '')

        const mergedDetails = {
          id: id || '',
          name: found?.name || id?.split('.').pop() || 'Aplikacja',
          version: found?.version || 'N/A',
          available: found?.available || '',
          source: found?.source || 'winget',
          description:
            'Zarządzanie tą aplikacją odbywa się poprzez Winget. Zapewnia ona główne narzędzia niezbędne do stabilnej pracy w systemie operacyjnym.',
          category: 'Narzędzia systemowe / Programy',
          tags: [] as string[],
          homepage: '',
          license: 'Proprietary',
          versions: [] as string[]
        }

        if (richRes.success && richRes.data) {
          const pkg = richRes.data
          mergedDetails.name = pkg.Latest?.Name || mergedDetails.name
          mergedDetails.description = pkg.Latest?.Description || mergedDetails.description
          mergedDetails.homepage = pkg.Latest?.Homepage || ''
          mergedDetails.license = pkg.Latest?.License || 'Proprietary'
          mergedDetails.tags = pkg.Latest?.Tags || []
          mergedDetails.versions = pkg.Versions || []
          mergedDetails.category = pkg.Latest?.Publisher || 'Oprogramowanie'
        }

        setAppDetails(mergedDetails)

        // 3. Pobierz customizację z lokalnej bazy
        const customRes = await window.api.getCustomization(id || '')
        if (customRes.success && customRes.data) {
          const c = customRes.data
          setCustomization(c)
          setEditName(c.customName || '')
          setEditDesc(c.customDesc || '')
          setEditIconUrl(c.customIconUrl || '')
          setEditNotes(c.notes || '')
          setEditScreenshots(
            c.screenshotUrls
              ? Array.isArray(c.screenshotUrls)
                ? c.screenshotUrls
                : JSON.parse(c.screenshotUrls)
              : []
          )
          setEditRating(c.rating || null)
          setEditReview(c.review || '')
          setEditTags(c.tags || [])
          setEditCategory(c.customCategory || '')
        }

        // 4. Screenshoty z MS Store (tylko dla msstore source)
        const source = found?.source || ''
        if (source === 'msstore' && id) {
          const storeRes = await window.api.getStoreDetails(id)
          if (storeRes.success && storeRes.data?.screenshots?.length > 0) {
            setScreenshots(storeRes.data.screenshots)
          }
        }
      } catch (e) {
        console.error('Error loading app details:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const handleSaveCustomization = async () => {
    if (!appDetails) return
    setSavingCustom(true)
    const res = await window.api.saveCustomization({
      wingetId: appDetails.id,
      customName: editName.trim() || null,
      customDesc: editDesc.trim() || null,
      customIconUrl: editIconUrl.trim() || null,
      notes: editNotes.trim() || null,
      screenshotUrls: editScreenshots,
      rating: editRating,
      review: editReview.trim() || null,
      tags: editTags,
      customCategory: editCategory.trim() || null
    })
    setSavingCustom(false)
    if (res.success) {
      setCustomization(res.data)
      setIsEditing(false)
      // Zaktualizuj widoczne dane
      setAppDetails((prev: any) => ({
        ...prev,
        name: editName.trim() || prev.name,
        description: editDesc.trim() || prev.description
      }))
    }
  }

  const handleDeleteCustomization = async () => {
    if (!appDetails) return
    await window.api.deleteCustomization(appDetails.id)
    setCustomization(null)
    setEditName('')
    setEditDesc('')
    setEditIconUrl('')
    setEditNotes('')
    setEditScreenshots([])
    setEditRating(null)
    setEditReview('')
    setEditTags([])
    setEditCategory('')
    setIsEditing(false)
  }

  const handleUpgrade = async (skipPreflight = false) => {
    if (!appDetails) return
    setUpgrading(true)
    setUpgradeError(null)
    setUacMode(false)
    setUpgradeSuccess(false)

    if (!skipPreflight) {
      setUpgradeStatus('preflight')
      try {
        const pfRes = await window.api.preflightDownload(appDetails.id)
        if (!pfRes.canDownload) {
          setPreflightResult(pfRes)
          setIsFailModalOpen(true)
          setUpgrading(false)
          setUpgradeStatus('idle')
          return
        }
      } catch (err: any) {
        console.error('Preflight check error:', err)
      }
    }

    setUpgradeStatus('downloading')
    const res = await window.api.upgradeApp({
      wingetId: appDetails.id,
      name: appDetails.name,
      previousVersion: appDetails.version,
      newVersion: appDetails.available
    })
    setUpgrading(false)
    setUpgradeStatus('idle')
    if (res.success) {
      setUpgradeSuccess(true)
      setTimeout(() => navigate('/software'), 2000)
    } else if (res.requiresElevation) {
      setUacMode(true)
    } else {
      setUpgradeError(res.error || 'Nieznany błąd aktualizacji.')
    }
  }

  const handleTryAnyway = () => {
    setIsFailModalOpen(false)
    handleUpgrade(true)
  }

  const handleElevatedUpgrade = async () => {
    if (!appDetails) return
    setElevating(true)
    await window.api.runElevatedUpgrade(appDetails.id)
    setElevating(false)
    setUacMode(false)
  }

  const openManualDownload = () => {
    if (!appDetails) return
    const url = appDetails.homepage || `https://winget.run/pkg/${appDetails.id.replace('.', '/')}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-100" style={{ gap: '20px' }}>
        <div className="loader-glowing"></div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '16px', fontWeight: 500 }}>
          Pobieranie zaawansowanych metadanych z repozytorium...
        </div>
      </div>
    )
  }

  if (!appDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-100" style={{ gap: '20px' }}>
        <div style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}>
          Nie znaleziono szczegółów tej aplikacji.
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/software')}>
          Wróć
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-100 app-details-container"
      style={{ paddingRight: '16px', overflowY: 'auto' }}
    >
      {/* Przycisk Wstecz */}
      <button
        onClick={() => navigate('/software')}
        className="back-breadcrumb"
        style={{
          alignSelf: 'flex-start',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          padding: '4px 8px',
          borderRadius: '8px'
        }}
      >
        <ArrowLeft size={16} />
        Powrót do Oprogramowania
      </button>

      {/* Główny Panel Szczegółów */}
      <div
        className="glass-panel"
        style={{
          padding: '0',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}
      >
        {/* Dynamiczny Premium Baner z gradientem */}
        <div
          style={{
            height: '180px',
            background:
              'linear-gradient(135deg, rgba(69, 243, 255, 0.08) 0%, rgba(107, 78, 230, 0.12) 100%)',
            position: 'relative',
            borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
          }}
        >
          {/* Efekt szklanej mgiełki i dekoracja geometryczna */}
          <div
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background:
                'radial-gradient(circle at 80% 20%, rgba(69, 243, 255, 0.15) 0%, transparent 50%)'
            }}
          />
        </div>

        {/* Sekcja Profilowa (z przesunięciem na baner) */}
        <div
          style={{
            padding: '0 32px 32px 32px',
            marginTop: '-50px',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div
            className="profile-header flex justify-between items-end"
            style={{ marginBottom: '32px', gap: '24px', flexWrap: 'wrap' }}
          >
            <div className="flex items-end gap-lg" style={{ flexWrap: 'wrap', gap: '24px' }}>
              <div
                className="logo-glow-wrapper"
                style={{
                  width: '100px',
                  height: '100px',
                  background: '#0d1117',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  padding: '12px'
                }}
              >
                <AppIcon
                  wingetId={appDetails.id}
                  name={appDetails.name}
                  homepage={appDetails.homepage}
                  size={76}
                />
              </div>

              {/* Informacje tekstowe */}
              <div style={{ minWidth: '200px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <h1
                    style={{
                      fontSize: '32px',
                      margin: 0,
                      fontWeight: 900,
                      letterSpacing: '-0.5px',
                      color: '#fff'
                    }}
                  >
                    {customization?.customName || appDetails.name}
                  </h1>
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing)
                      if (!isEditing) {
                        setEditName(customization?.customName || '')
                        setEditDesc(customization?.customDesc || '')
                        setEditIconUrl(customization?.customIconUrl || '')
                        setEditNotes(customization?.notes || '')
                        setEditRating(customization?.rating || null)
                        setEditReview(customization?.review || '')
                        setEditTags(customization?.tags || [])
                        setEditCategory(customization?.customCategory || '')
                      }
                    }}
                    title={isEditing ? 'Anuluj edycję' : 'Edytuj aplikację'}
                    style={{
                      background: isEditing ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isEditing ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '8px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      color: isEditing ? '#f87171' : 'rgba(255,255,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isEditing ? (
                      <>
                        <X size={14} /> Anuluj
                      </>
                    ) : (
                      <>
                        <Pencil size={14} /> Edytuj
                      </>
                    )}
                  </button>
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      background: 'rgba(69, 243, 255, 0.1)',
                      color: 'var(--color-primary)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontWeight: 700
                    }}
                  >
                    {customization?.customCategory || appDetails.category}
                  </span>
                  {customization?.rating && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                      title={`Ocena: ${customization.rating}/5`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          fill={star <= customization.rating ? '#FFC400' : 'transparent'}
                          stroke={
                            star <= customization.rating ? '#FFC400' : 'rgba(255,255,255,0.3)'
                          }
                        />
                      ))}
                    </div>
                  )}
                  <span
                    style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}
                  >
                    ID: {appDetails.id}
                  </span>
                  {customization && (
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(139,92,246,0.15)',
                        color: '#a78bfa',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(139,92,246,0.3)'
                      }}
                    >
                      Edytowane
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Przycisk instalacji / aktualizacji */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}
            >
              {upgradeSuccess && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#34d399',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  <CheckCircle size={18} />
                  Zaktualizowano! Przekierowanie...
                </div>
              )}

              {upgradeError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#f87171',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      <AlertCircle size={16} /> Aktualizacja nie powiodła się
                    </div>
                    <button
                      onClick={() => setUpgradeError(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: 'Courier New, monospace',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      maxHeight: '80px',
                      overflowY: 'auto',
                      wordBreak: 'break-word'
                    }}
                  >
                    {upgradeError}
                  </p>
                  <button
                    onClick={openManualDownload}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      alignSelf: 'flex-end',
                      background: 'rgba(251,191,36,0.1)',
                      border: '1px solid rgba(251,191,36,0.3)',
                      color: '#fbbf24',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={12} /> Pobierz ręcznie
                  </button>
                </div>
              )}

              {uacMode && (
                <div
                  style={{
                    background: 'rgba(251, 146, 60, 0.08)',
                    border: '1px solid rgba(251, 146, 60, 0.25)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#fb923c',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      <ShieldAlert size={16} /> Wymagane uprawnienia admina
                    </div>
                    <button
                      onClick={() => setUacMode(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.6
                    }}
                  >
                    Instalator wymaga UAC. Zostanie otwarte{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.75)' }}>jedno okno</strong> z prośbą
                    o potwierdzenie.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)'
                    }}
                  >
                    <RefreshCw size={11} /> Po instalacji odśwież listę oprogramowania.
                  </div>
                  <button
                    disabled={elevating}
                    onClick={handleElevatedUpgrade}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'rgba(251, 146, 60, 0.15)',
                      border: '1px solid rgba(251, 146, 60, 0.4)',
                      color: '#fb923c',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: elevating ? 'not-allowed' : 'pointer',
                      opacity: elevating ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <ShieldAlert size={14} />
                    {elevating ? 'Otwieranie...' : 'Otwórz okno instalacji (UAC)'}
                  </button>
                </div>
              )}

              <button
                className={`btn ${appDetails.available ? 'btn-primary pulse-glowing' : 'btn-secondary'}`}
                style={{
                  padding: '16px 36px',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: '14px',
                  minWidth: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: appDetails.available ? '0 0 20px rgba(69, 243, 255, 0.2)' : 'none'
                }}
                disabled={upgrading || !appDetails.available || upgradeSuccess}
                onClick={() => handleUpgrade(false)}
              >
                <DownloadCloud size={18} />
                {upgrading
                  ? upgradeStatus === 'preflight'
                    ? 'Weryfikowanie...'
                    : 'Pobieranie...'
                  : appDetails.available
                    ? 'Aktualizuj teraz'
                    : 'Program jest aktualny'}
              </button>
            </div>
          </div>

          <hr
            style={{
              border: 'none',
              height: '1px',
              background: 'rgba(255,255,255,0.04)',
              margin: '32px 0'
            }}
          />

          {/* Główny układ informacyjny */}
          <div
            className="app-grid-details"
            style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}
          >
            {/* Lewa kolumna: Opis, TagCloud, Historia Wersji */}
            <div className="flex flex-col gap-lg" style={{ gap: '32px' }}>
              {/* Panel edycji (tryb admina) */}
              {isEditing && (
                <div
                  style={{
                    background: 'rgba(139,92,246,0.06)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#a78bfa',
                      fontSize: '14px',
                      fontWeight: 700
                    }}
                  >
                    <Pencil size={16} /> Panel edycji aplikacji
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Nazwa (nadpisuje)
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={appDetails.name}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Opis (nadpisuje)
                    </label>
                    <RichEditor
                      content={editDesc}
                      onChange={setEditDesc}
                      placeholder={appDetails.description?.slice(0, 80) + '...'}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Kategoria (nadpisuje)
                    </label>
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder={appDetails.category}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Twoja Ocena
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = editRating !== null && star <= editRating
                          return (
                            <Star
                              key={star}
                              size={22}
                              fill={active ? '#FFC400' : 'transparent'}
                              stroke={active ? '#FFC400' : 'rgba(255,255,255,0.3)'}
                              onClick={() => setEditRating(star)}
                              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                            />
                          )
                        })}
                      </div>
                      {editRating !== null && (
                        <button
                          type="button"
                          onClick={() => setEditRating(null)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-error)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Wyczyść
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Twoja Opinia / Recenzja
                    </label>
                    <textarea
                      value={editReview}
                      onChange={(e) => setEditReview(e.target.value)}
                      placeholder="Napisz co sądzisz o tej aplikacji..."
                      rows={3}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Własne Tagi
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                        placeholder="Wpisz tag i naciśnij Enter"
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        style={{
                          background: 'rgba(69,243,255,0.1)',
                          border: '1px solid rgba(69,243,255,0.3)',
                          color: 'var(--color-primary)',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Dodaj
                      </button>
                    </div>
                    {editTags.length > 0 && (
                      <div
                        style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}
                      >
                        {editTags.map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'rgba(255,255,255,0.8)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() =>
                                setEditTags((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: '2px'
                              }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      <Link size={10} style={{ display: 'inline', marginRight: '4px' }} />
                      URL ikony (nadpisuje Clearbit)
                    </label>
                    <input
                      value={editIconUrl}
                      onChange={(e) => setEditIconUrl(e.target.value)}
                      placeholder="https://example.com/icon.png"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Notatki prywatne
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Np. konfiguracja, licencja, uwagi..."
                      rows={2}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {/* Screenshoty — upload z dysku */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <label
                        style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.4)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        <Image size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        Screenshoty ({editScreenshots.length})
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await window.api.pickScreenshot()
                          if (res.success && res.paths.length > 0) {
                            setEditScreenshots((prev) => [...prev, ...res.paths])
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(69,243,255,0.08)',
                          border: '1px solid rgba(69,243,255,0.2)',
                          color: 'var(--color-primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Dodaj obrazy
                      </button>
                    </div>
                    {editScreenshots.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {editScreenshots.map((filePath, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'relative',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            <img
                              src={`file://${filePath}`}
                              alt={`Screen ${i + 1}`}
                              style={{
                                height: '80px',
                                width: 'auto',
                                display: 'block',
                                objectFit: 'cover'
                              }}
                            />
                            <button
                              onClick={async () => {
                                await window.api.deleteScreenshot(filePath)
                                setEditScreenshots((prev) => prev.filter((_, idx) => idx !== i))
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'rgba(0,0,0,0.7)',
                                border: 'none',
                                borderRadius: '4px',
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      disabled={savingCustom}
                      onClick={handleSaveCustomization}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(139,92,246,0.2)',
                        border: '1px solid rgba(139,92,246,0.4)',
                        color: '#a78bfa',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Save size={14} /> {savingCustom ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    {customization && (
                      <button
                        onClick={handleDeleteCustomization}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: '#f87171',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} /> Reset do domyślnych
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Opis oprogramowania */}
              {!isEditing && (
                <div className="details-section">
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#fff',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <FileText size={20} color="var(--color-primary)" />
                    Opis programu
                    {customization?.customDesc && (
                      <span
                        style={{
                          fontSize: '11px',
                          background: 'rgba(139,92,246,0.15)',
                          color: '#a78bfa',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(139,92,246,0.3)',
                          fontWeight: 600
                        }}
                      >
                        Edytowany
                      </span>
                    )}
                  </h2>
                  <div
                    style={{
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.8,
                      fontSize: '15px',
                      margin: 0,
                      textAlign: 'justify'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: customization?.customDesc || appDetails.description || ''
                    }}
                  />
                </div>
              )}

              {/* Sekcja opinii i oceny */}
              {!isEditing && (customization?.rating || customization?.review) ? (
                <div
                  className="details-section glass-panel"
                  style={{
                    padding: '20px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '16px'
                  }}
                >
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#fff',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: 0
                    }}
                  >
                    <Star size={18} fill="#FFC400" stroke="#FFC400" />
                    <span>Twoja Ocena i Recenzja</span>
                  </h3>
                  {customization.rating && (
                    <div style={{ display: 'flex', gap: '4px', margin: '12px 0' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          fill={star <= customization.rating ? '#FFC400' : 'transparent'}
                          stroke={
                            star <= customization.rating ? '#FFC400' : 'rgba(255,255,255,0.2)'
                          }
                        />
                      ))}
                    </div>
                  )}
                  {customization.review && (
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        fontStyle: 'italic',
                        background: 'rgba(0,0,0,0.15)',
                        padding: '12px',
                        borderRadius: '10px',
                        borderLeft: '3px solid var(--color-primary)'
                      }}
                    >
                      "{customization.review}"
                    </p>
                  )}
                </div>
              ) : (
                !isEditing && (
                  <div
                    className="details-section"
                    style={{
                      textAlign: 'center',
                      padding: '16px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: '13px',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      Nie dodałeś jeszcze opinii o tym programie.
                    </p>
                    <button
                      onClick={() => {
                        setIsEditing(true)
                        setEditName(customization?.customName || '')
                        setEditDesc(customization?.customDesc || '')
                        setEditIconUrl(customization?.customIconUrl || '')
                        setEditNotes(customization?.notes || '')
                        setEditRating(customization?.rating || null)
                        setEditReview(customization?.review || '')
                        setEditTags(customization?.tags || [])
                        setEditCategory(customization?.customCategory || '')
                      }}
                      style={{
                        background: 'rgba(69,243,255,0.06)',
                        border: '1px solid rgba(69,243,255,0.2)',
                        color: 'var(--color-primary)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Dodaj ocenę i opinię
                    </button>
                  </div>
                )
              )}

              {/* Tag Cloud */}
              {displayTags && displayTags.length > 0 && (
                <div className="details-section">
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '12px'
                    }}
                  >
                    Tagi i kategorie spersonalizowane
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {displayTags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="tag-badge"
                        style={{
                          fontSize: '12px',
                          color: 'rgba(255,255,255,0.6)',
                          background: 'rgba(255,255,255,0.03)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.05)',
                          fontWeight: 500,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Screenshoty MS Store */}
              {screenshots.length > 0 ? (
                <div className="details-section">
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#fff',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <ImageOff size={20} color="var(--color-primary)" style={{ display: 'none' }} />
                    Screenshoty
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(69,243,255,0.1)',
                        color: 'var(--color-primary)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(69,243,255,0.2)',
                        fontWeight: 600
                      }}
                    >
                      MS Store
                    </span>
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      overflowX: 'auto',
                      paddingBottom: '8px'
                    }}
                    className="screenshots-scroll"
                  >
                    {screenshots.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Screenshot ${i + 1}`}
                        style={{
                          height: '160px',
                          borderRadius: '10px',
                          flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.06)',
                          objectFit: 'cover'
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : appDetails.source === 'msstore' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '13px'
                  }}
                >
                  <ImageOff size={16} /> Brak screenshotów w Store API
                </div>
              ) : null}

              {appDetails.versions && appDetails.versions.length > 0 && (
                <div className="details-section">
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#fff',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Clock size={20} color="var(--color-primary)" />
                    Dostępne wersje w repozytorium
                  </h2>
                  <div
                    className="versions-timeline-wrapper"
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      padding: '16px',
                      borderRadius: '16px',
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '10px'
                      }}
                    >
                      {appDetails.versions.map((ver: string, idx: number) => {
                        const isCurrent = ver === appDetails.version
                        const isAvailable = ver === appDetails.available
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '10px',
                              borderRadius: '10px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: isCurrent || isAvailable ? 700 : 500,
                              background: isCurrent
                                ? 'rgba(69, 243, 255, 0.1)'
                                : isAvailable
                                  ? 'rgba(107, 78, 230, 0.1)'
                                  : 'rgba(255, 255, 255, 0.02)',
                              border: isCurrent
                                ? '1px solid rgba(69, 243, 255, 0.3)'
                                : isAvailable
                                  ? '1px solid rgba(107, 78, 230, 0.3)'
                                  : '1px solid rgba(255, 255, 255, 0.04)',
                              color: isCurrent
                                ? 'var(--color-primary)'
                                : isAvailable
                                  ? '#a78bfa'
                                  : 'rgba(255,255,255,0.6)',
                              boxShadow: isCurrent ? '0 0 10px rgba(69, 243, 255, 0.15)' : 'none'
                            }}
                          >
                            {ver}
                            {isCurrent && (
                              <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.8 }}>
                                (zainstalowana)
                              </div>
                            )}
                            {isAvailable && (
                              <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.8 }}>
                                (aktualizacja)
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Prawa kolumna: Specyfikacja techniczna & Bezpieczeństwo */}
            <div className="flex flex-col gap-lg" style={{ gap: '24px' }}>
              {/* Karta Parametrów Technicznych */}
              <div
                className="glass-panel spec-card"
                style={{
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '20px'
                }}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#fff',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Specyfikacja
                </h3>

                <ul
                  className="flex flex-col gap-sm"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingBottom: '14px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Server size={14} /> Wydawca
                    </span>
                    <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                      {appDetails.category}
                    </span>
                  </li>

                  {appDetails.homepage && (
                    <li
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingBottom: '14px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        fontSize: '14px',
                        alignItems: 'center'
                      }}
                    >
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Globe size={14} /> Witryna
                      </span>
                      <a
                        href={appDetails.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="homepage-link"
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {(() => {
                          try {
                            return new URL(appDetails.homepage).hostname.replace('www.', '')
                          } catch {
                            return appDetails.homepage
                          }
                        })()}
                      </a>
                    </li>
                  )}

                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingBottom: '14px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Award size={14} /> Licencja
                    </span>
                    <span
                      style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}
                    >
                      {appDetails.license}
                    </span>
                  </li>

                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingBottom: '14px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Obecna wersja</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#fff',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {appDetails.version}
                    </span>
                  </li>

                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingBottom: '6px',
                      fontSize: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nowa aktualizacja</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: appDetails.available
                          ? 'var(--color-primary)'
                          : 'rgba(255,255,255,0.5)',
                        background: appDetails.available
                          ? 'rgba(69, 243, 255, 0.08)'
                          : 'rgba(255,255,255,0.02)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {appDetails.available || 'Brak aktualizacji'}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Tarcza Bezpieczeństwa */}
              <div
                className="glass-panel security-shield-panel"
                style={{
                  padding: '24px',
                  background: 'rgba(16, 185, 129, 0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.1)',
                  borderRadius: '20px',
                  boxShadow: 'inset 0 0 20px rgba(16, 185, 129, 0.02)'
                }}
              >
                <h3
                  className="flex items-center gap-sm"
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#34d399',
                    marginBottom: '12px'
                  }}
                >
                  <Shield size={22} />
                  Kryptograficzne bezpieczeństwo
                </h3>
                <p
                  className="text-muted"
                  style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, color: '#a7f3d0' }}
                >
                  Menedżer pobiera oprogramowanie wyłącznie z oficjalnych repozytoriów społeczności
                  Winget. Każdy pakiet instalacyjny przed uruchomieniem przechodzi automatyczną
                  weryfikację sum kontrolnych SHA-256 w systemie operacyjnym Windows, gwarantując
                  integralność danych.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DownloadFailModal
        isOpen={isFailModalOpen}
        onClose={() => setIsFailModalOpen(false)}
        onTryAnyway={handleTryAnyway}
        appName={appDetails?.name || ''}
        wingetId={appDetails?.id || ''}
        reason={preflightResult?.errorReason}
        statusCode={preflightResult?.statusCode}
        installerUrl={preflightResult?.installerUrl}
        homepageUrl={appDetails?.homepage}
      />

      {/* Globalne style i animacje dla Premium View */}
      <style>{`
        .loader-glowing {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(69, 243, 255, 0.1);
          border-top: 4px solid var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite, glowPulse 1.5s ease-in-out infinite alternate;
        }

        .logo-glow-wrapper {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .logo-glow-wrapper:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 12px 40px rgba(69, 243, 255, 0.25), 0 0 0 1px rgba(69, 243, 255, 0.4) !important;
        }

        .back-breadcrumb:hover {
          color: var(--color-primary) !important;
          transform: translateX(-4px);
          background: rgba(255, 255, 255, 0.02) !important;
        }

        .homepage-link:hover {
          color: #fff !important;
          text-shadow: 0 0 8px rgba(69, 243, 255, 0.5);
          text-decoration: underline !important;
        }

        .tag-badge:hover {
          background: rgba(69, 243, 255, 0.08) !important;
          color: var(--color-primary) !important;
          border-color: rgba(69, 243, 255, 0.2) !important;
          transform: translateY(-1px);
        }

        .pulse-glowing {
          animation: pulseShadow 2s infinite;
        }

        .versions-timeline-wrapper::-webkit-scrollbar {
          width: 6px;
        }
        .versions-timeline-wrapper::-webkit-scrollbar-track {
          background: transparent;
        }
        .versions-timeline-wrapper::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .versions-timeline-wrapper::-webkit-scrollbar-thumb:hover {
          background: rgba(69, 243, 255, 0.3);
        }

        .screenshots-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .screenshots-scroll::-webkit-scrollbar { height: 4px; }
        .screenshots-scroll::-webkit-scrollbar-track { background: transparent; }
        .screenshots-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .screenshots-scroll::-webkit-scrollbar-thumb:hover { background: rgba(69,243,255,0.3); }

        .edit-input:focus, .edit-textarea:focus {
          border-color: rgba(139,92,246,0.5) !important;
          box-shadow: 0 0 0 2px rgba(139,92,246,0.1);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes glowPulse {
          0% { box-shadow: 0 0 5px rgba(69, 243, 255, 0.2); }
          100% { box-shadow: 0 0 20px rgba(69, 243, 255, 0.6); }
        }

        @keyframes pulseShadow {
          0% { box-shadow: 0 0 0 0 rgba(69, 243, 255, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(69, 243, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(69, 243, 255, 0); }
        }

        @media (max-width: 950px) {
          .app-grid-details {
            grid-template-columns: 1fr !important;
          }
          .profile-header {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .profile-header button {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
