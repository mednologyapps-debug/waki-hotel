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
  if (
    window.google
      ?.maps
      ?.importLibrary
  ) {
    return Promise.resolve(
      window.google
    )
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  const apiKey =
    import.meta.env
      .VITE_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return Promise.reject(
      new Error(
        'Falta configurar VITE_GOOGLE_MAPS_API_KEY.'
      )
    )
  }

  googleMapsPromise =
    new Promise(
      (resolve, reject) => {
        const existingScript =
          document.querySelector(
            'script[data-waki-google-maps="true"]'
          )

        if (existingScript) {
          existingScript.addEventListener(
            'load',
            () => resolve(
              window.google
            ),
            {
              once: true
            }
          )

          existingScript.addEventListener(
            'error',
            () => reject(
              new Error(
                'No pudimos cargar Google Maps.'
              )
            ),
            {
              once: true
            }
          )

          return
        }

        const script =
          document.createElement(
            'script'
          )

        script.src =
          'https://maps.googleapis.com/maps/api/js' +
          '?key=' +
          encodeURIComponent(
            apiKey
          ) +
          '&v=weekly' +
          '&loading=async'

        script.async =
          true

        script.defer =
          true

        script.dataset
          .wakiGoogleMaps =
          'true'

        script.onload =
          () => resolve(
            window.google
          )

        script.onerror =
          () => reject(
            new Error(
              'No pudimos cargar Google Maps.'
            )
          )

        document.head.appendChild(
          script
        )
      }
    )

  return googleMapsPromise
}


function findAddressPart(
  components,
  types
) {
  const component =
    components?.find(
      (item) =>
        types.some(
          (type) =>
            item.types
              ?.includes(
                type
              )
        )
    )

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
                    'Google Maps no devolvió una ubicación válida.'
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
                        'locality'
                      ]
                    ),

                  province:
                    findAddressPart(
                      components,
                      [
                        'administrative_area_level_2'
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

        map.addListener(
          'click',
          (
            event
          ) => {
            if (
              !event.latLng
            ) {
              return
            }

            const nextLatitude =
              event.latLng.lat()

            const nextLongitude =
              event.latLng.lng()

            marker.setPosition(
              event.latLng
            )

            marker.setVisible(
              true
            )

            onLocationSelected({
              latitude:
                nextLatitude,

              longitude:
                nextLongitude,

              address:
                null,

              district:
                null,

              province:
                null,

              department:
                null,

              placeName:
                null
            })
          }
        )
      } catch (
        error
      ) {
        console.error(
          'Error inicializando Google Maps:',
          error
        )

        setErrorMessage(
          error?.message ||
          'No pudimos cargar el selector de ubicación.'
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
  }, [])


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
