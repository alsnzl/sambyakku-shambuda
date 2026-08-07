package com.sambyakku.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    preferHighestRefreshRate();
  }

  /** Prefer 90/120Hz when the panel supports it so WebView rAF stays smooth. */
  private void preferHighestRefreshRate() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
    Display display = getWindowManager().getDefaultDisplay();
    Display.Mode[] modes = display.getSupportedModes();
    if (modes == null || modes.length == 0) return;

    Display.Mode best = display.getMode();
    for (Display.Mode mode : modes) {
      if (mode.getPhysicalWidth() != best.getPhysicalWidth()
          || mode.getPhysicalHeight() != best.getPhysicalHeight()) {
        continue;
      }
      if (mode.getRefreshRate() > best.getRefreshRate()) {
        best = mode;
      }
    }

    WindowManager.LayoutParams params = getWindow().getAttributes();
    params.preferredDisplayModeId = best.getModeId();
    getWindow().setAttributes(params);
  }
}
