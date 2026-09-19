App({
  globalData: {
    // 填写云开发环境 ID 后改为 true；未配置时自动使用本地演示数据。
    useCloud: true,
    cloudEnvId: "cloud1-d7gakrphzaa052a42"
  },
  onLaunch() {
    if (this.globalData.useCloud && wx.cloud) {
      wx.cloud.init({ env: this.globalData.cloudEnvId || undefined, traceUser: true })
    }
  }
})
