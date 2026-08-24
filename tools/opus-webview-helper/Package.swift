// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpusWebViewHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "opus-webview-helper", targets: ["OpusWebViewHelper"]),
    ],
    targets: [
        .executableTarget(name: "OpusWebViewHelper"),
    ]
)
