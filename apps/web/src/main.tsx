import ReactDOM from 'react-dom/client'

// 最简渲染测试
const root = document.getElementById('root')!
root.innerHTML = ''
const div = document.createElement('div')
div.style.cssText = 'color:#fff;background:#1a1a2e;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif'
div.innerHTML = '<div style="text-align:center"><h1 style="color:#38b2ac">IOMTea</h1><p style="color:#888">系统加载中...</p><p style="color:#666;font-size:12px" id="status">检查模块...</p></div>'
root.appendChild(div)

const status = () => document.getElementById('status')!

// 逐步导入测试
async function boot() {
  let ok = true
  try {
    const m = await import('./routes')
    status().textContent += '\n✓ routes.tsx'
    const router = m.router
    const React = await import('react')
    const { RouterProvider } = await import('@tanstack/react-router')
    root.innerHTML = ''
    const { createRoot } = await import('react-dom/client')
    createRoot(root).render(React.createElement(RouterProvider, { router }))
  } catch(e: any) {
    status().textContent += `\n✗ 错误: ${e.message}`
    status().style.color = 'red'
    console.error(e)
  }
}
boot()
