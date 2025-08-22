import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from '../../components/header'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

// Mock child components
vi.mock('../../components/mode-toggle', () => ({
  ModeToggle: () => <button>Toggle Mode</button>,
}))

vi.mock('../../components/user-menu', () => ({
  default: () => <div>User Menu</div>,
}))

describe('Header Component', () => {
  it('renders navigation links', () => {
    render(<Header />)
    
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders mode toggle and user menu', () => {
    render(<Header />)
    
    expect(screen.getByText('Toggle Mode')).toBeInTheDocument()
    expect(screen.getByText('User Menu')).toBeInTheDocument()
  })
})