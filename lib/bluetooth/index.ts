export const BLUETOOTH_SERVICES = {
  BLOOD_PRESSURE: 0x1810,
  WEIGHT_SCALE: 0x181D,
  HEALTH_THERMOMETER: 0x1809,
  PULSE_OXIMETER: 0x1822,
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function connectBloodPressure(): Promise<{ systolic: number; diastolic: number; pulse: number } | null> {
  if (!isBluetoothSupported()) return null
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [BLUETOOTH_SERVICES.BLOOD_PRESSURE] }],
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(BLUETOOTH_SERVICES.BLOOD_PRESSURE)
    const char = await service.getCharacteristic(0x2A35)
    await char.startNotifications()

    return new Promise((resolve) => {
      char.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value
        const flags = value.getUint8(0)
        const isKpa = flags & 0x01
        const systolic = value.getUint16(1, true) / (isKpa ? 10 : 1)
        const diastolic = value.getUint16(3, true) / (isKpa ? 10 : 1)
        const pulse = value.getUint16(14, true)
        char.stopNotifications()
        server.disconnect()
        resolve({ systolic, diastolic, pulse })
      })
    })
  } catch {
    return null
  }
}

export async function connectWeightScale(): Promise<{ weight: number } | null> {
  if (!isBluetoothSupported()) return null
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [BLUETOOTH_SERVICES.WEIGHT_SCALE] }],
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(BLUETOOTH_SERVICES.WEIGHT_SCALE)
    const char = await service.getCharacteristic(0x2A9D)
    await char.startNotifications()

    return new Promise((resolve) => {
      char.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value
        const weight = value.getUint16(1, true) * 0.005
        char.stopNotifications()
        server.disconnect()
        resolve({ weight })
      })
    })
  } catch {
    return null
  }
}

export async function connectThermometer(): Promise<{ temperature: number } | null> {
  if (!isBluetoothSupported()) return null
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [BLUETOOTH_SERVICES.HEALTH_THERMOMETER] }],
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(BLUETOOTH_SERVICES.HEALTH_THERMOMETER)
    const char = await service.getCharacteristic(0x2A1C)
    await char.startNotifications()

    return new Promise((resolve) => {
      char.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value
        const temp = value.getFloat32(1, true)
        char.stopNotifications()
        server.disconnect()
        resolve({ temperature: Math.round(temp * 10) / 10 })
      })
    })
  } catch {
    return null
  }
}
