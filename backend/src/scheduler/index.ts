import cron from 'node-cron'

export function startScheduler() {
  // Placeholder for future data pipeline tasks:
  // - Fetch Game Pass catalog
  // - Fetch EA Play catalog
  // - Fetch PS Plus catalog

  // Example: cron.schedule('0 6 * * *', () => { ... })

  console.log('Scheduler started')

  return {
    stop: () => {
      cron.getTasks().forEach((task) => task.stop())
      console.log('Scheduler stopped')
    },
  }
}
