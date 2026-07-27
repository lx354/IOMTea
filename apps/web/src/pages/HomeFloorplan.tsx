export function HomeFloorplan() {
  return (
    <iframe
      src="/floorplan.html"
      style={{
        width: '100%', height: 'calc(100vh - 100px)',
        border: 'none', borderRadius: 8,
      }}
      title="居家环境平面图"
    />
  )
}
