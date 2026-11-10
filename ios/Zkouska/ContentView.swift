import SwiftUI

struct ContentView: View {
    @AppStorage("pocet") private var pocet = 0
    @AppStorage("poznamka") private var poznamka = ""
    @FocusState private var pise: Bool

    private var verze: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "?"
        let b = info?["CFBundleVersion"] as? String ?? "?"
        return "Verze \(v) (sestavení \(b))"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Počítadlo") {
                    HStack {
                        Text("\(pocet)")
                            .font(.system(size: 56, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .contentTransition(.numericText())
                        Spacer()
                        Button {
                            withAnimation { pocet += 1 }
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 48))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.tint)
                        .accessibilityLabel("Přičíst")
                    }
                    Button("Vynulovat", role: .destructive) {
                        withAnimation { pocet = 0 }
                    }
                    .disabled(pocet == 0)
                }

                Section("Poznámka") {
                    TextField("Napište cokoli…", text: $poznamka, axis: .vertical)
                        .lineLimit(3...8)
                        .focused($pise)
                }

                Section {
                    Text("Počítadlo i poznámka zůstanou uložené i po zavření aplikace.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } footer: {
                    Text(verze)
                }
            }
            .navigationTitle("Zkouška")
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Hotovo") { pise = false }
                }
            }
        }
    }
}
