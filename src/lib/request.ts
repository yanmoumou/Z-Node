import axios from 'axios'

const request = axios.create({
  timeout: 60000,
})

request.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时'))
    }
    if (!error.response) {
      return Promise.reject(new Error('网络错误'))
    }
    return Promise.reject(new Error(error.response.data?.error || '请求失败'))
  }
)

export default request

