package com.slink.school

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val chime: Uri
        get() = Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://$packageName/${R.raw.bus_chime}")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createBusChannel()
    }

    /**
     * "Bus arriving" pushes name this channel (api fcm.service.ts SOUNDS), so
     * they ring with the chime even when the app is closed. A channel's sound
     * is fixed once created; a new sound needs a new channel id.
     */
    private fun createBusChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "bus_arrival",
            getString(R.string.bus_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = getString(R.string.bus_channel_description)
            setSound(
                chime,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /** The app plays the chime itself for a push that arrives while it's open. */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "slink/sounds").setMethodCallHandler { call, result ->
            if (call.method == "busChime") {
                RingtoneManager.getRingtone(applicationContext, chime)?.apply {
                    audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    play()
                }
                result.success(null)
            } else {
                result.notImplemented()
            }
        }
    }
}
