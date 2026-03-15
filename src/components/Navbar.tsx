'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',          label: 'Dashboard' },
  { href: '/insights',  label: 'Insights'  },
  { href: '/thisweek',  label: 'This week' },
  { href: '/history',   label: 'History'   },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="navbar">
      <span className="navbar-brand">Training</span>
      <div className="navbar-links">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`navbar-link ${pathname === link.href ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}