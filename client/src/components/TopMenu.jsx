import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function TopMenu({ roleId }) {
  const [menu, setMenu] = useState([])

  useEffect(() => {
    if (!roleId) return
    axios.get(`/api/menu?roleId=${roleId}`).then(r => setMenu(r.data)).catch(err => { console.error(err); setMenu([]) })
  }, [roleId])

  // Build hierarchical menu: parents and children
  const parents = menu.filter(m => !m.parent_id)
  const childrenByParent = menu.reduce((acc, m) => {
    if (m.parent_id) {
      acc[m.parent_id] = acc[m.parent_id] || []
      acc[m.parent_id].push(m)
    }
    return acc
  }, {})

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
      <div className="container-fluid">
        <a className="navbar-brand" href="/">UBL Manager</a>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#topMenuCollapse" aria-controls="topMenuCollapse" aria-expanded="false" aria-label="Abrir menú" title="Abrir menú">
          <i className="fa-solid fa-bars" aria-hidden="true" />
        </button>
        <div className="collapse navbar-collapse" id="topMenuCollapse">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {parents.map(item => {
              const children = childrenByParent[item.id] || []
              if (children.length > 0) {
                return (
                  <li className="nav-item dropdown" key={item.id}>
                    <a className="nav-link dropdown-toggle" href={item.path || '#'} id={`menu-${item.id}`} role="button" data-bs-toggle="dropdown" aria-expanded="false">{item.title}</a>
                    <ul className="dropdown-menu" aria-labelledby={`menu-${item.id}`}>
                      {children.map(ch => (
                        <li key={ch.id}><a className="dropdown-item" href={ch.path}>{ch.title}</a></li>
                      ))}
                    </ul>
                  </li>
                )
              }
              return (
                <li className="nav-item" key={item.id}>
                  <a className="nav-link" href={item.path}>{item.title}</a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
