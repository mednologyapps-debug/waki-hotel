import {
  useEffect,
  useRef,
  useState
} from 'react'

import {
  MapPin,
  Search
} from 'lucide-react'


let googleMapsPromise = null


function loadGoogleMaps() {
  if (googleMapsPromise) return googleMapsPromise
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('MAPS_KEY_MISSING'))

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const callback = 'wakiGoogleMapsReady'
    const timeout = window.setTimeout(fail, 15000)
    function cleanup() {
      window.clearTimeout(timeout)
      delete window[callback]
    }
    function fail() {
      cleanup()
      script.remove()
      reject(new Error('MAPS_LOAD_FAILED'))
    }
    window[callback] = () => {
      if (!window.google?.maps?.importLibrary) return fail()
      cleanup()
      resolve(window.google)
    }
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
      key: apiKey, v: 'weekly', loading: 'async', callback, language: 'es', region: 'PE'
    })
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  }).catch(error => {
    googleMapsPromise = null
    throw error
  })
  return googleMapsPromise
}


function findAddressPart(
  components,
  types
) {
  const component = types
    .map(type => components?.find(item => item.types?.includes(type)))
    .find(Boolean)

  return component?.longText ||
    component?.long_name ||
    ''
}


export default function HotelLocationPicker({
  latitude,
  longitude,
  address,
  onLocationSelected
}) {
  const mapContainerRef =
    useRef(null)

  const autocompleteContainerRef =
    useRef(null)

  const mapRef =
    useRef(null)

  const markerRef =
    useRef(null)

  const autocompleteRef =
    useRef(null)

  const [attempt, setAttempt] = useState(0)
  const [initializationFailed, setInitializationFailed] = useState(false)
  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')


  useEffect(() => {
    let cancelled =
      false

    async function initialize() {
      try {
        setLoading(true)
        setInitializationFailed(false)
        setErrorMessage('')

        const google =
          await loadGoogleMaps()

        if (
          cancelled ||
          !mapContainerRef.current ||
          !autocompleteContainerRef.current
        ) {
          return
        }

        const {
          Map
        } =
          await google.maps
            .importLibrary(
              'maps'
            )

        const {
          PlaceAutocompleteElement
        } =
          await google.maps
            .importLibrary(
              'places'
            )


        const initialPosition =
          latitude != null &&
          longitude != null
            ? {
                lat:
                  Number(
                    latitude
                  ),

                lng:
                  Number(
                    longitude
                  )
              }
            : {
                lat:
                  -12.0464,

                lng:
                  -77.0428
              }

        const map =
          new Map(
            mapContainerRef.current,
            {
              center:
                initialPosition,

              zoom:
                latitude != null &&
                longitude != null
                  ? 17
                  : 12,

              streetViewControl:
                false,

              mapTypeControl:
                false,

              fullscreenControl:
                false,

              clickableIcons:
                false
            }
          )

        mapRef.current =
          map

        const marker =
          new google.maps.Marker({
            map,
            position:
              initialPosition,

            visible:
              latitude != null &&
              longitude != null
          })

        markerRef.current =
          marker

        const autocomplete =
          new PlaceAutocompleteElement()

        autocomplete.placeholder =
          'Busca tu hotel o ingresa la dirección exacta'

        autocomplete.includedRegionCodes =
          [
            'pe'
          ]

        autocomplete.locationBias =
          {
            center: {
              lat:
                -12.0464,

              lng:
                -77.0428
            },

            radius:
              40000
          }

        autocompleteContainerRef
          .current
          .replaceChildren(
            autocomplete
          )

        autocompleteRef.current =
          autocomplete

        autocomplete
          .addEventListener(
            'gmp-select',
            async (
              event
            ) => {
              try {
                const place =
                  event
                    .placePrediction
                    .toPlace()

                await place
                  .fetchFields({
                    fields: [
                      'displayName',
                      'formattedAddress',
                      'location',
                      'viewport',
                      'addressComponents'
                    ]
                  })

                if (
                  !place.location
                ) {
                  throw new Error(
                    'No encontramos las coordenadas del lugar. Selecciona otro resultado.'
                  )
                }

                const nextLatitude =
                  place.location.lat()

                const nextLongitude =
                  place.location.lng()

                marker.setPosition(
                  place.location
                )

                marker.setVisible(
                  true
                )

                if (
                  place.viewport
                ) {
                  map.fitBounds(
                    place.viewport
                  )
                } else {
                  map.setCenter(
                    place.location
                  )

                  map.setZoom(
                    17
                  )
                }

                const components =
                  place.addressComponents ||
                  []

                onLocationSelected({
                  latitude:
                    nextLatitude,

                  longitude:
                    nextLongitude,

                  address:
                    place.formattedAddress ||
                    address ||
                    '',

                  district:
                    findAddressPart(
                      components,
                      [
                        'sublocality_level_1',
                        'administrative_area_level_3',
                        'locality'
                      ]
                    ),

                  province:
                    findAddressPart(
                      components,
                      [
                        'administrative_area_level_2', 'locality'
                      ]
                    ),

                  department:
                    findAddressPart(
                      components,
                      [
                        'administrative_area_level_1'
                      ]
                    ),

                  placeName:
                    place.displayName ||
                    ''
                })
              } catch (
                error
              ) {
                console.error(
                  'Error seleccionando ubicación:',
                  error
                )

                setErrorMessage(
                  error?.message ||
                  'No pudimos usar esa ubicación.'
                )
              }
            }
          )

        let geocoder
        let latestPin = 0
        map.addListener('click', async (event) => {
          if (!event.latLng) return
          const requestId = ++latestPin
          const nextLatitude = event.latLng.lat()
          const nextLongitude = event.latLng.lng()
          marker.setPosition(event.latLng)
          marker.setVisible(true)
          setErrorMessage('')
          try {
            // Clicking the pin must update the ADDRESS, not just coordinates.
            if (!geocoder) {
              const { Geocoder } = await google.maps.importLibrary('geocoding')
              geocoder = new Geocoder()
            }
            const { results } = await geocoder.geocode({
              location: { lat: nextLatitude, lng: nextLongitude }
            })
            if (cancelled || requestId !== latestPin) return
            const result = results?.[0]
            if (!result) throw new Error('ADDRESS_NOT_FOUND')
            const components = result.address_components || []
            onLocationSelected({
              latitude: nextLatitude,
              longitude: nextLongitude,
              address: result.formatted_address || '',
              district: findAddressPart(components, [
                'sublocality_level_1', 'administrative_area_level_3', 'locality'
              ]),
              province: findAddressPart(components, ['administrative_area_level_2','locality']),
              department: findAddressPart(components, ['administrative_area_level_1']),
              placeName: ''
            })
          } catch {
            if (cancelled || requestId !== latestPin) return
            // Keep the selected point, allow the person to complete address manually.
            onLocationSelected({
              latitude: nextLatitude, longitude: nextLongitude,
              address: '', district: '', province: '', department: '', placeName: ''
            })
            setErrorMessage('Marcamos el punto, pero no pudimos obtener la dirección. Complétala manualmente en el formulario.')
          }
        })
      } catch (
        error
      ) {
        if (cancelled) return
        setInitializationFailed(true)
        console.error(
          'Error inicializando Google Maps:',
          error
        )

        setErrorMessage(
          'El mapa no está disponible en este momento. Puedes completar la dirección manualmente o contactar a WAKI.'
        )
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      cancelled =
        true
    }
  }, [attempt])


  useEffect(() => {
    const map =
      mapRef.current

    const marker =
      markerRef.current

    if (
      !map ||
      !marker ||
      latitude == null ||
      longitude == null
    ) {
      return
    }

    const position =
      {
        lat:
          Number(
            latitude
          ),

        lng:
          Number(
            longitude
          )
      }

    marker.setPosition(
      position
    )

    marker.setVisible(
      true
    )
  }, [
    latitude,
    longitude
  ])


  return (
    <section className="hotel-location-picker">

      <div className="hotel-location-picker__heading">

        <div>

          <MapPin
            size={18}
            strokeWidth={1.8}
          />

        </div>

        <div>

          <strong>
            Ubicación en Google Maps
          </strong>

          <span>
            Busca tu hotel por nombre o escribe la dirección exacta.
          </span>

        </div>

      </div>


      <div className="hotel-location-picker__search">

        <Search
          size={17}
          strokeWidth={1.8}
        />

        <div
          ref={
            autocompleteContainerRef
          }
          className="hotel-location-picker__autocomplete"
        />

      </div>


      <div
        ref={
          mapContainerRef
        }
        className="hotel-location-picker__map"
      />


      {loading && (

        <div className="hotel-location-picker__status">

          Cargando Google Maps...

        </div>

      )}


      {errorMessage && (

        <div className="hotel-location-picker__error">

          {errorMessage}
          {initializationFailed && <button type="button" className="hotel-setup-secondary-button"
            onClick={() => setAttempt(value => value + 1)}>Reintentar mapa</button>}

        </div>

      )}


      <div className="hotel-location-picker__footer">

        <span>

          {latitude != null &&
          longitude != null
            ? 'Ubicación seleccionada'
            : 'Aún no seleccionaste la ubicación exacta'
          }

        </span>

        {latitude != null &&
        longitude != null && (

          <code>

            {
              Number(
                latitude
              )
                .toFixed(
                  6
                )
            }

            {' · '}

            {
              Number(
                longitude
              )
                .toFixed(
                  6
                )
            }

          </code>

        )}

      </div>


      <small>
        También puedes hacer clic directamente sobre el mapa para ajustar el punto exacto.
      </small>

    </section>
  )
}
