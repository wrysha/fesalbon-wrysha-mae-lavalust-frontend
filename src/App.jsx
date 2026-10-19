import { useEffect, useMemo, useState } from 'react'
import {
  API_BASE_URL,
  ApiError,
  clearSession,
  getStoredSession,
  login,
  logout,
  productsApi,
  saveSession,
} from './api.js'

const emptyProduct = {
  product_name: '',
  description: '',
  price: '',
  quantity: '',
}

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

function App() {
  const [session, setSession] = useState(() => getStoredSession())

  useEffect(() => {
    const expire = () => setSession(null)
    window.addEventListener('lab6:auth-expired', expire)
    return () => window.removeEventListener('lab6:auth-expired', expire)
  }, [])

  async function handleLogin(credentials) {
    const response = await login(credentials)
    saveSession(response.user, response.tokens)
    setSession({ user: response.user, tokens: response.tokens })
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearSession()
      setSession(null)
    }
  }

  return session
    ? <ProductWorkspace user={session.user} onLogout={handleLogout} />
    : <LoginScreen onLogin={handleLogin} />
}

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await onLogin(form)
    } catch (requestError) {
      setError(requestError.message || 'Sign in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="brand-lockup">
            <span className="brand-seal">P</span>
            <div>
              <strong>Pandayan</strong>
              <small>Inventory studio</small>
            </div>
          </div>

          <div className="form-heading">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to continue</h2>
            <p>Use your authorized account to manage products.</p>
          </div>

          {error && <div className="notice danger" role="alert">{error}</div>}

          <label className="field">
            <span>Username</span>
            <input
              autoComplete="username"
              autoFocus
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="Enter your username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
              required
            />
          </label>

          <button className="button primary wide" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="api-caption">Connected to {API_BASE_URL}</p>
        </form>
      </section>
    </main>
  )
}

function ProductWorkspace({ user, onLogout }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [editor, setEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const totals = useMemo(() => products.reduce((summary, product) => ({
    units: summary.units + Number(product.quantity || 0),
    value: summary.value + Number(product.price || 0) * Number(product.quantity || 0),
  }), { units: 0, value: 0 }), [products])

  async function loadProducts(showLoader = true) {
    if (showLoader) setLoading(true)

    try {
      const response = await productsApi.list()
      setProducts(response.data || [])
    } catch (error) {
      setFeedback({ type: 'danger', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  async function saveProduct(values) {
    setWorking(true)

    try {
      const response = editor.mode === 'edit'
        ? await productsApi.update(editor.product.id, values)
        : await productsApi.create(values)

      setFeedback({ type: 'success', message: response.message })
      setEditor(null)
      await loadProducts(false)
    } finally {
      setWorking(false)
    }
  }

  async function deleteProduct() {
    setWorking(true)

    try {
      const response = await productsApi.remove(deleteTarget.id)
      setFeedback({ type: 'success', message: response.message })
      setDeleteTarget(null)
      await loadProducts(false)
    } catch (error) {
      setFeedback({ type: 'danger', message: error.message })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup compact" href="#main" aria-label="Pandayan inventory home">
          <span className="brand-seal">P</span>
          <div>
            <strong>Pandayan</strong>
            <small>Inventory studio</small>
          </div>
        </a>

        <div className="account-block">
          <div>
            <small>Signed in as</small>
            <strong>{user.display_name || user.username}</strong>
          </div>
          <button className="button ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <main id="main" className="workspace">
        <section className="page-intro">
          <div>
            <p className="eyebrow">Curated inventory</p>
            <h1>Product collection</h1>
            <p>Keep every item, price, and stock count beautifully organized.</p>
          </div>
          <button
            className="button primary"
            onClick={() => setEditor({ mode: 'create', product: emptyProduct })}
          >
            <span aria-hidden="true">＋</span> Add product
          </button>
        </section>

        {feedback && (
          <div className={`notice ${feedback.type}`} role="status">
            <span>{feedback.message}</span>
            <button aria-label="Dismiss message" onClick={() => setFeedback(null)}>×</button>
          </div>
        )}

        <section className="summary-grid" aria-label="Inventory summary">
          <SummaryCard label="Products" value={products.length} detail="unique pieces" />
          <SummaryCard label="Available stock" value={totals.units} detail="units on hand" />
          <SummaryCard label="Inventory value" value={money.format(totals.value)} detail="current retail value" />
        </section>

        <section className="collection-card">
          <div className="collection-heading">
            <div>
              <h2>All products</h2>
              <p>{products.length} {products.length === 1 ? 'record' : 'records'} from Aiven MySQL</p>
            </div>
            <button className="text-button" onClick={() => loadProducts()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh list'}
            </button>
          </div>

          {loading ? (
            <div className="empty-state"><span className="spinner" /> Loading your collection…</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <span className="empty-mark">P</span>
              <h3>Your collection is ready to begin.</h3>
              <p>Add the first product to your inventory.</p>
              <button className="button secondary" onClick={() => setEditor({ mode: 'create', product: emptyProduct })}>
                Add first product
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Added</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td data-label="Product">
                        <strong>{product.product_name}</strong>
                        <small>{product.description}</small>
                      </td>
                      <td data-label="Price" className="number">{money.format(Number(product.price))}</td>
                      <td data-label="Quantity"><span className="stock-pill">{product.quantity} in stock</span></td>
                      <td data-label="Added">{formatDate(product.created_at)}</td>
                      <td className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${product.product_name}`}
                          onClick={() => setEditor({ mode: 'edit', product })}
                        >
                          Edit
                        </button>
                        <button
                          className="icon-button danger-text"
                          aria-label={`Delete ${product.product_name}`}
                          onClick={() => setDeleteTarget(product)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>React frontend</span><i /> <span>LavaLust API</span><i /> <span>Aiven MySQL</span>
      </footer>

      {editor && (
        <ProductDialog
          editor={editor}
          busy={working}
          onClose={() => !working && setEditor(null)}
          onSave={saveProduct}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          product={deleteTarget}
          busy={working}
          onClose={() => !working && setDeleteTarget(null)}
          onConfirm={deleteProduct}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, detail }) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function ProductDialog({ editor, busy, onClose, onSave }) {
  const [form, setForm] = useState({
    product_name: editor.product.product_name || '',
    description: editor.product.description || '',
    price: editor.product.price || '',
    quantity: editor.product.quantity ?? '',
  })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const isEdit = editor.mode === 'edit'

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    setMessage('')

    try {
      await onSave(form)
    } catch (error) {
      if (error instanceof ApiError && error.details) {
        setErrors(error.details)
      }
      setMessage(error.message || 'The product could not be saved.')
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">{isEdit ? 'Update collection' : 'New collection item'}</p>
        <h2 id="product-dialog-title">{isEdit ? 'Edit product' : 'Add product'}</h2>
        <p className="modal-copy">
          {isEdit ? 'Refine the product details below.' : 'Enter the details for your new inventory item.'}
        </p>

        {message && <div className="notice danger" role="alert">{message}</div>}

        <form className="product-form" onSubmit={submit}>
          <label className="field full">
            <span>Product name</span>
            <input
              autoFocus
              maxLength="100"
              value={form.product_name}
              onChange={(event) => update('product_name', event.target.value)}
              placeholder="e.g. Hand-bound journal"
              required
            />
            {errors.product_name && <small className="field-error">{errors.product_name}</small>}
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea
              rows="4"
              maxLength="2000"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Describe the product in a few thoughtful words."
              required
            />
            {errors.description && <small className="field-error">{errors.description}</small>}
          </label>

          <label className="field">
            <span>Price (PHP)</span>
            <input
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
              placeholder="0.00"
              required
            />
            {errors.price && <small className="field-error">{errors.price}</small>}
          </label>

          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={(event) => update('quantity', event.target.value)}
              placeholder="0"
              required
            />
            {errors.quantity && <small className="field-error">{errors.quantity}</small>}
          </label>

          <div className="modal-actions full">
            <button type="button" className="button ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function DeleteDialog({ product, busy, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="modal compact-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="delete-mark" aria-hidden="true">!</span>
        <p className="eyebrow">Remove from collection</p>
        <h2 id="delete-title">Delete this product?</h2>
        <p className="modal-copy">
          <strong>{product.product_name}</strong> will be permanently removed from the Aiven database.
        </p>
        <div className="modal-actions">
          <button className="button ghost" onClick={onClose} disabled={busy}>Keep product</button>
          <button className="button danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete product'}
          </button>
        </div>
      </section>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default App
