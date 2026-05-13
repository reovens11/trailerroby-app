package com.trailerroby.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class TrailerRobyMessagingService extends FirebaseMessagingService {

    static final String CHANNEL_ID = "trailerroby_alerts";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        new Thread(() -> {
            try {
                URL url = new URL("https://traileroby.com/api/register-fcm");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                String body = "{\"token\":\"" + token.replace("\"", "") + "\"}";
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        super.onMessageReceived(msg);

        String title = "🚨 התראת תנועה";
        String body = "";
        boolean isFullScreen = false;

        if (!msg.getData().isEmpty()) {
            if (msg.getData().containsKey("title")) title = msg.getData().get("title");
            if (msg.getData().containsKey("body"))  body  = msg.getData().get("body");
            isFullScreen = "true".equals(msg.getData().get("fullscreen"));
        }
        if (msg.getNotification() != null) {
            if (msg.getNotification().getTitle() != null) title = msg.getNotification().getTitle();
            if (msg.getNotification().getBody()  != null) body  = msg.getNotification().getBody();
        }

        createChannel();

        if (isFullScreen) {
            showFullScreen(title, body);
        } else {
            showNormal(title, body);
        }
    }

    private void showFullScreen(String title, String body) {
        Intent alertIntent = new Intent(this, AlertActivity.class);
        alertIntent.putExtra("title", title);
        alertIntent.putExtra("body", body);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // אם יש הרשאת SYSTEM_ALERT_WINDOW — פתח Activity ישירות (חסום מסך באמצע)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
            startActivity(alertIntent);
            return;
        }

        // גיבוי: notification עם full-screen intent (לכאשר מסך כבוי)
        PendingIntent fsPendingIntent = PendingIntent.getActivity(
            this, 1001, alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fsPendingIntent, true)
            .setAutoCancel(true)
            .setVibrate(new long[]{0, 500, 200, 500});

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(1001, builder.build());
    }

    private void showNormal(String title, String body) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify((int) System.currentTimeMillis(), builder.build());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "התראות תנועה", NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("התראות משטרה ומשרד התחבורה");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 500, 200, 500});
            ch.enableLights(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(ch);
        }
    }
}
