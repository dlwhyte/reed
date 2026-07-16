import UIKit

private let appGroupID = "group.com.dlwhyte.reed"
private let tokenDefaultsKey = "bookmarklet_token"
private let backendBase = "https://browsefellow.com"

class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let dismissButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        setupUI()
        setStatus("Looking for a link…")
        handleShare()
    }

    private func setupUI() {
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()

        dismissButton.setTitle("Dismiss", for: .normal)
        dismissButton.translatesAutoresizingMaskIntoConstraints = false
        dismissButton.isHidden = true
        dismissButton.addTarget(self, action: #selector(dismissTapped), for: .touchUpInside)

        view.addSubview(statusLabel)
        view.addSubview(spinner)
        view.addSubview(dismissButton)

        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -30),
            statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            dismissButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            dismissButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
        ])

        preferredContentSize = CGSize(width: 320, height: 200)
    }

    @objc private func dismissTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func setStatus(_ text: String) {
        statusLabel.text = text
    }

    private func handleShare() {
        guard let token = storedToken(), !token.isEmpty else {
            promptForToken()
            return
        }
        setStatus("Reading shared link…")
        extractSharedURL { [weak self] url in
            guard let self else { return }
            guard let url else {
                self.finish(message: "No link found to save.", success: false)
                return
            }
            self.save(url: url, token: token)
        }
    }

    private func storedToken() -> String? {
        UserDefaults(suiteName: appGroupID)?.string(forKey: tokenDefaultsKey)
    }

    private func promptForToken() {
        let alert = UIAlertController(
            title: "Connect BrowseFellow",
            message: "Paste your bookmarklet token from BrowseFellow → Settings. This is a one-time setup.",
            preferredStyle: .alert
        )
        alert.addTextField { field in
            field.placeholder = "Bookmarklet token"
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
            self?.finish(message: nil, success: false)
        })
        alert.addAction(UIAlertAction(title: "Save", style: .default) { [weak self] _ in
            guard let self else { return }
            let token = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !token.isEmpty else {
                self.finish(message: "No token entered.", success: false)
                return
            }
            UserDefaults(suiteName: appGroupID)?.set(token, forKey: tokenDefaultsKey)
            self.handleShare()
        })
        present(alert, animated: true)
    }

    private func extractSharedURL(completion: @escaping (URL?) -> Void) {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = item.attachments else {
            completion(nil)
            return
        }

        let urlType = "public.url"
        if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(urlType) }) {
            provider.loadItem(forTypeIdentifier: urlType, options: nil) { data, _ in
                if let url = data as? URL {
                    completion(url)
                } else if let url = data as? NSURL {
                    completion(url as URL)
                } else {
                    completion(nil)
                }
            }
            return
        }

        let textType = "public.plain-text"
        if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(textType) }) {
            provider.loadItem(forTypeIdentifier: textType, options: nil) { data, _ in
                if let text = data as? String,
                   let range = text.range(of: "https?://\\S+", options: .regularExpression) {
                    completion(URL(string: String(text[range])))
                } else {
                    completion(nil)
                }
            }
            return
        }

        completion(nil)
    }

    private func save(url: URL, token: String) {
        guard var components = URLComponents(string: "\(backendBase)/api/save") else {
            finish(message: "Bad configuration.", success: false)
            return
        }
        components.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let endpoint = components.url else {
            finish(message: "Bad configuration.", success: false)
            return
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["url": url.absoluteString])
        // The backend's save path can itself take up to ~20s fetching the
        // source page, plus Cohere summarize/embed calls on top — give it
        // real headroom so we don't show a false timeout for a save that's
        // actually still completing server-side.
        request.timeoutInterval = 45

        setStatus("Connecting to BrowseFellow…")
        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let error {
                    self.finish(message: "Couldn't save: \(error.localizedDescription)", success: false)
                    return
                }
                guard let http = response as? HTTPURLResponse else {
                    self.finish(message: "Couldn't save: no response.", success: false)
                    return
                }
                if http.statusCode == 401 || http.statusCode == 403 {
                    // Stale/invalid token — clear it so the next share re-prompts.
                    UserDefaults(suiteName: appGroupID)?.removeObject(forKey: tokenDefaultsKey)
                    self.finish(message: "Token invalid — try sharing again to reconnect.", success: false)
                    return
                }
                guard (200...299).contains(http.statusCode) else {
                    self.finish(message: "Save failed (\(http.statusCode)).", success: false)
                    return
                }
                self.finish(message: "Saved to BrowseFellow", success: true)
            }
        }.resume()
    }

    private func finish(message: String?, success: Bool) {
        if let message {
            statusLabel.text = message
        }
        spinner.stopAnimating()

        // On success, auto-dismiss quickly. On failure, leave the message on
        // screen with a Dismiss button so it can actually be read (and
        // reported) instead of vanishing after a fixed delay.
        if success {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            }
        } else if message == nil {
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        } else {
            dismissButton.isHidden = false
        }
    }
}
