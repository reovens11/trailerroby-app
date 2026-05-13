package com.trailerroby.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public class AlertActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // הצג מעל מסך נעילה והדלק מסך
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            Window w = getWindow();
            w.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        setContentView(R.layout.activity_alert);

        String title = getIntent().getStringExtra("title");
        String body  = getIntent().getStringExtra("body");

        TextView tvTitle = findViewById(R.id.alert_title);
        TextView tvBody  = findViewById(R.id.alert_body);
        Button   btnOk   = findViewById(R.id.alert_ok);

        if (title != null) tvTitle.setText(title);
        if (body  != null) tvBody.setText(body);

        btnOk.setOnClickListener(v -> {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.cancel(1001);
            finish();
        });
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String title = intent.getStringExtra("title");
        String body  = intent.getStringExtra("body");
        TextView tvTitle = findViewById(R.id.alert_title);
        TextView tvBody  = findViewById(R.id.alert_body);
        if (title != null) tvTitle.setText(title);
        if (body  != null) tvBody.setText(body);
    }
}
