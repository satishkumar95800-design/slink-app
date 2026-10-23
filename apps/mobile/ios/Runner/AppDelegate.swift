import AudioToolbox
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // The app plays the bus chime itself for a push that arrives while it's
    // open; closed, iOS plays bus_chime.wav named in the push.
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "SlinkSounds") {
      FlutterMethodChannel(name: "slink/sounds", binaryMessenger: registrar.messenger())
        .setMethodCallHandler { call, result in
          guard call.method == "busChime" else { return result(FlutterMethodNotImplemented) }
          AppDelegate.playChime()
          result(nil)
        }
    }
  }

  private static var chimeId: SystemSoundID = 0

  private static func playChime() {
    if chimeId == 0, let url = Bundle.main.url(forResource: "bus_chime", withExtension: "wav") {
      AudioServicesCreateSystemSoundID(url as CFURL, &chimeId)
    }
    if chimeId != 0 { AudioServicesPlaySystemSound(chimeId) }
  }
}
