// SmartHub Service Worker — hanterar Web Push notiser

self.addEventListener("install", (event) => {
  // Aktivera direkt utan att vänta på reload
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Inkommande push från Web Push-protokollet
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "SmartHub", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "SmartHub"
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "smarthub",
    data: data.data || {},
    requireInteraction: !!data.requireInteraction,
    silent: !!data.silent,
    vibrate: data.vibrate || [200, 100, 200],
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Klick på notis öppnar appen (eller fokuserar befintlig flik)
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})

// Hantera prenumeration-update (när browser uppdaterar endpoint)
self.addEventListener("pushsubscriptionchange", (event) => {
  // Klienten själv hanterar re-subscription nästa gång appen öppnas
})
