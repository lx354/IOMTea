export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
    'pages/alerts/index',
    'pages/devices/index',
    'pages/data/index',
    'pages/settings/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTitleText: 'IOMTea',
    navigationBarTextStyle: 'white',
  },
  permission: {
    'scope.userLocation': {
      desc: '需要获取您的位置信息用于设备定位',
    },
  },
})
