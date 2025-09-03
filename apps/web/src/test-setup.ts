import { configure } from '@testing-library/react'
import '@testing-library/jest-dom'

// 测试库配置
configure({ testIdAttribute: 'data-testid', asyncUtilTimeout: 2000 })