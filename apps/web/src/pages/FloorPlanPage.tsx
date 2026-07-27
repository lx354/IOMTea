import { Box } from '@mantine/core'

export function FloorPlanPage() {
  return (
    <Box style={{ width: '100%', height: 'calc(100vh - 112px)', overflow: 'hidden' }}>
      <iframe
        src="/floorplan.html"
        title="居家环境 2D 数字孪生"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
          background: '#0a0e14',
        }}
      />
    </Box>
  )
}
