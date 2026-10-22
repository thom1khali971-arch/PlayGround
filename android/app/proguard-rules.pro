# Regras do ProGuard (o app não usa bibliotecas externas).
-keepclassmembers class com.grandmasterlab.chess.MainActivity$OverlayBridge {
    public *;
}
