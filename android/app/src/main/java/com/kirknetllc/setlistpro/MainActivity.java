package com.kirknetllc.setlistpro;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // We initially set the app to draw edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Initial immersive application. 
        // Note: We do NOT re-apply on window focus change to allow JS to control the state via plugins.
        applyImmersiveMode();
    }

    private void applyImmersiveMode() {
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decorView);
        if (controller == null) return;

        controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }
}