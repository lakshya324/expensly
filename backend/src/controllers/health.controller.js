// Health Check Controller

export class HealthController {
  static getHealth(req, res) {
    res.status(200).json({
      success: true,
      message: "Expensly Backend is running",
      timestamp: new Date().toISOString(),
    });
  }
}
