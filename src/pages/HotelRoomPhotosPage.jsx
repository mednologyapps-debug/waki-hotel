import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Star,
  Trash2,
  UploadCloud
} from 'lucide-react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import HotelOnboardingGuide
  from '../components/hotel/HotelOnboardingGuide'

import {
  supabase
} from '../lib/supabase'


export default function HotelRoomPhotosPage() {
  const navigate =
    useNavigate()

  const {
    roomId
  } =
    useParams()


  const fileInputRef =
    useRef(null)


  const [loading, setLoading] =
    useState(true)

  const [uploading, setUploading] =
    useState(false)

  const [actionLoadingId, setActionLoadingId] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [hotelId, setHotelId] =
    useState(null)

  const [room, setRoom] =
    useState(null)

  const [images, setImages] =
    useState([])

  const [setupRooms, setSetupRooms] =
    useState([])


  useEffect(() => {
    loadPage()
  }, [roomId])


  /* =========================================================
     CARGAR PÁGINA
     ========================================================= */

  async function loadPage() {
    try {
      setLoading(true)

      setErrorMessage('')


      const {
        data: {
          session
        },
        error: sessionError
      } =
        await supabase
          .auth
          .getSession()


      if (sessionError) {
        throw sessionError
      }


      if (!session?.user) {
        throw new Error(
          'No encontramos una sesión activa.'
        )
      }


      /* =====================================================
         PERFIL
         ===================================================== */

      const {
        data: profileData,
        error: profileError
      } =
        await supabase
          .from('profiles')
          .select(`
            id,
            full_name
          `)
          .eq(
            'id',
            session.user.id
          )
          .maybeSingle()


      if (profileError) {
        throw profileError
      }


      setProfile(
        profileData
      )


      /* =====================================================
         HOTEL ASIGNADO
         ===================================================== */

      const {
        data: staffData,
        error: staffError
      } =
        await supabase
          .from('hotel_staff')
          .select(`
            hotel_id
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .eq(
            'is_active',
            true
          )
          .limit(1)
          .maybeSingle()


      if (staffError) {
        throw staffError
      }


      if (!staffData?.hotel_id) {
        throw new Error(
          'Esta cuenta no tiene una sede asignada.'
        )
      }


      setHotelId(
        staffData.hotel_id
      )


      /* =====================================================
         HOTEL
         ===================================================== */

      const {
        data: hotelData,
        error: hotelError
      } =
        await supabase
          .from('hotels')
          .select(`
            id,
            name,
            district,
            province,
            approval_status,
            is_active
          `)
          .eq(
            'id',
            staffData.hotel_id
          )
          .maybeSingle()


      if (hotelError) {
        throw hotelError
      }


      if (!hotelData) {
        throw new Error(
          'No encontramos la información de tu hotel.'
        )
      }


      setHotel(
        hotelData
      )


      /* =====================================================
         HABITACIÓN ACTUAL
         ===================================================== */

      const {
        data: roomData,
        error: roomError
      } =
        await supabase
          .from('room_types')
          .select(`
            id,
            hotel_id,
            name
          `)
          .eq(
            'id',
            roomId
          )
          .eq(
            'hotel_id',
            staffData.hotel_id
          )
          .maybeSingle()


      if (roomError) {
        throw roomError
      }


      if (!roomData) {
        throw new Error(
          'No encontramos esta habitación dentro de tu hotel.'
        )
      }


      setRoom(
        roomData
      )


      await Promise.all([
        loadImages(),

        loadSetupRooms(
          staffData.hotel_id
        )
      ])

    } catch (error) {
      console.error(
        'Error cargando fotografías:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar las fotografías.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     CARGAR IMÁGENES
     ========================================================= */

  async function loadImages() {
    const {
      data,
      error
    } =
      await supabase
        .from('room_type_images')
        .select(`
          id,
          image_url,
          storage_path,
          is_cover,
          display_order,
          created_at
        `)
        .eq(
          'room_type_id',
          roomId
        )
        .order(
          'is_cover',
          {
            ascending: false
          }
        )
        .order(
          'display_order',
          {
            ascending: true
          }
        )


    if (error) {
      throw error
    }


    setImages(
      data || []
    )
  }


  /* =========================================================
     TODAS LAS HABITACIONES ACTIVAS
     ========================================================= */

  async function loadSetupRooms(
    targetHotelId = hotelId
  ) {
    if (!targetHotelId) {
      return
    }


    const {
      data,
      error
    } =
      await supabase
        .from('room_types')
        .select(`
          id,
          name,
          display_order,
          is_active,

          room_type_images (
            id
          ),

          rate_plans (
            id,
            is_active
          )
        `)
        .eq(
          'hotel_id',
          targetHotelId
        )
        .eq(
          'is_active',
          true
        )
        .order(
          'display_order',
          {
            ascending: true
          }
        )


    if (error) {
      throw error
    }


    setSetupRooms(
      data || []
    )
  }


  /* =========================================================
     REFRESCAR ESTADO
     ========================================================= */

  async function refreshPhotoState() {
    await loadImages()


    if (hotelId) {
      await loadSetupRooms(
        hotelId
      )
    }
  }


  /* =========================================================
     ABRIR SELECTOR
     ========================================================= */

  function openFilePicker() {
    fileInputRef
      .current
      ?.click()
  }


  /* =========================================================
     SUBIR FOTOGRAFÍAS
     ========================================================= */

  async function handleFileChange(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
        []
      )


    if (!files.length) {
      return
    }


    try {
      setUploading(true)

      setErrorMessage('')
      setSuccessMessage('')


      if (!hotelId) {
        throw new Error(
          'No pudimos identificar tu hotel.'
        )
      }


      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ]


      const baseCount =
        images.length


      for (
        let index = 0;
        index < files.length;
        index += 1
      ) {
        const file =
          files[index]


        if (
          !allowedTypes.includes(
            file.type
          )
        ) {
          throw new Error(
            'Solo se permiten imágenes JPG, PNG o WEBP.'
          )
        }


        if (
          file.size >
          8 * 1024 * 1024
        ) {
          throw new Error(
            'Cada imagen debe pesar menos de 8 MB.'
          )
        }


        const extension =
          file.name
            .split('.')
            .pop()
            ?.toLowerCase() ||
          'jpg'


        const uniqueName =
          `${crypto.randomUUID()}.${extension}`


        const storagePath =
          `${hotelId}/${roomId}/${uniqueName}`


        const {
          error: uploadError
        } =
          await supabase
            .storage
            .from('room-images')
            .upload(
              storagePath,
              file,
              {
                cacheControl:
                  '3600',

                upsert:
                  false
              }
            )


        if (uploadError) {
          throw uploadError
        }


        const {
          data: publicUrlData
        } =
          supabase
            .storage
            .from('room-images')
            .getPublicUrl(
              storagePath
            )


        const {
          error: insertError
        } =
          await supabase
            .from('room_type_images')
            .insert({
              room_type_id:
                roomId,

              image_url:
                publicUrlData.publicUrl,

              storage_path:
                storagePath,

              is_cover:
                baseCount === 0 &&
                index === 0,

              display_order:
                baseCount +
                index
            })


        if (insertError) {
          await supabase
            .storage
            .from('room-images')
            .remove([
              storagePath
            ])


          throw insertError
        }
      }


      await refreshPhotoState()


      setSuccessMessage(
        files.length === 1
          ? 'La fotografía se subió correctamente.'
          : 'Las fotografías se subieron correctamente.'
      )

    } catch (error) {
      console.error(
        'Error subiendo fotografías:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos subir las fotografías.'
      )

    } finally {
      setUploading(false)


      if (
        fileInputRef.current
      ) {
        fileInputRef
          .current
          .value = ''
      }
    }
  }


  /* =========================================================
     DEFINIR PORTADA
     ========================================================= */

  async function setCover(
    image
  ) {
    try {
      setActionLoadingId(
        image.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error: clearError
      } =
        await supabase
          .from('room_type_images')
          .update({
            is_cover:
              false
          })
          .eq(
            'room_type_id',
            roomId
          )


      if (clearError) {
        throw clearError
      }


      const {
        error: coverError
      } =
        await supabase
          .from('room_type_images')
          .update({
            is_cover:
              true,

            display_order:
              0
          })
          .eq(
            'id',
            image.id
          )
          .eq(
            'room_type_id',
            roomId
          )


      if (coverError) {
        throw coverError
      }


      await refreshPhotoState()


      setSuccessMessage(
        'La fotografía principal se actualizó.'
      )

    } catch (error) {
      console.error(
        'Error actualizando portada:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos actualizar la fotografía principal.'
      )

    } finally {
      setActionLoadingId(
        null
      )
    }
  }


  /* =========================================================
     ELIMINAR IMAGEN
     ========================================================= */

  async function deleteImage(
    image
  ) {
    const confirmed =
      window.confirm(
        '¿Quieres eliminar esta fotografía?'
      )


    if (!confirmed) {
      return
    }


    try {
      setActionLoadingId(
        image.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error: deleteError
      } =
        await supabase
          .from('room_type_images')
          .delete()
          .eq(
            'id',
            image.id
          )
          .eq(
            'room_type_id',
            roomId
          )


      if (deleteError) {
        throw deleteError
      }


      if (
        image.storage_path
      ) {
        const {
          error: storageError
        } =
          await supabase
            .storage
            .from('room-images')
            .remove([
              image.storage_path
            ])


        if (storageError) {
          console.warn(
            'No se pudo limpiar el archivo del storage:',
            storageError
          )
        }
      }


      const remaining =
        images.filter(
          (item) =>
            item.id !==
            image.id
        )


      if (
        image.is_cover &&
        remaining.length > 0
      ) {
        const nextImage =
          remaining[0]


        const {
          error: nextCoverError
        } =
          await supabase
            .from('room_type_images')
            .update({
              is_cover:
                true,

              display_order:
                0
            })
            .eq(
              'id',
              nextImage.id
            )
            .eq(
              'room_type_id',
              roomId
            )


        if (nextCoverError) {
          throw nextCoverError
        }
      }


      await refreshPhotoState()


      setSuccessMessage(
        'La fotografía se eliminó correctamente.'
      )

    } catch (error) {
      console.error(
        'Error eliminando fotografía:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos eliminar la fotografía.'
      )

    } finally {
      setActionLoadingId(
        null
      )
    }
  }


  /* =========================================================
     UBICACIÓN
     ========================================================= */

  const hotelLocation =
    useMemo(
      () =>
        [
          hotel?.district,
          hotel?.province
        ]
          .filter(Boolean)
          .join(', '),
      [
        hotel
      ]
    )


  /* =========================================================
     PRIMERA HABITACIÓN SIN FOTOS
     ========================================================= */

  const firstRoomWithoutPhotos =
    useMemo(
      () =>
        setupRooms.find(
          (setupRoom) =>
            (
              setupRoom.room_type_images ||
              []
            ).length === 0
        ) ||
        null,
      [
        setupRooms
      ]
    )


  /* =========================================================
     PRIMERA HABITACIÓN SIN TARIFA
     ========================================================= */

  const firstRoomWithoutRates =
    useMemo(
      () =>
        setupRooms.find(
          (setupRoom) => {

            const activeRates =
              (
                setupRoom.rate_plans ||
                []
              )
                .filter(
                  (rate) =>
                    rate.is_active !== false
                )


            return (
              activeRates.length === 0
            )
          }
        ) ||
        null,
      [
        setupRooms
      ]
    )


  /* =========================================================
     CTA INFERIOR
     ========================================================= */

  const onboardingAction =
    useMemo(
      () => {

        if (
          !hotel ||
          [
            'pending_review',
            'approved',
            'suspended'
          ].includes(
            hotel.approval_status
          )
        ) {
          return null
        }


        if (
          setupRooms.length === 0
        ) {
          return null
        }


        /* =================================================
           FALTAN FOTOS
           ================================================= */

        if (
          firstRoomWithoutPhotos
        ) {
          const isCurrentRoom =
            firstRoomWithoutPhotos.id ===
            roomId


          return {
            eyebrow:
              isCurrentRoom
                ? 'Fotografías pendientes'
                : 'Siguiente habitación',

            title:
              isCurrentRoom
                ? 'Agrega al menos una fotografía para continuar.'
                : `${firstRoomWithoutPhotos.name} todavía necesita fotografías.`,

            buttonLabel:
              isCurrentRoom
                ? 'Agregar fotografía'
                : 'Continuar con fotografías',

            action:
              isCurrentRoom
                ? 'upload'
                : 'navigate',

            route:
              isCurrentRoom
                ? null
                : `/habitaciones/${firstRoomWithoutPhotos.id}/fotos`
          }
        }


        /* =================================================
           FALTAN TARIFAS
           ================================================= */

        if (
          firstRoomWithoutRates
        ) {
          return {
            eyebrow:
              'Siguiente paso',

            title:
              'Las fotografías están listas. Ahora configura tus tarifas.',

            buttonLabel:
              'Continuar con tarifas',

            action:
              'navigate',

            route:
              '/tarifas'
          }
        }


        /* =================================================
           TODO LISTO
           ================================================= */

        return {
          eyebrow:
            'Configuración completa',

          title:
            'Tus habitaciones, fotografías y tarifas están listas.',

          buttonLabel:
            'Revisar configuración',

          action:
            'navigate',

          route:
            '/mi-hotel/revision'
        }
      },
      [
        hotel,
        setupRooms,
        firstRoomWithoutPhotos,
        firstRoomWithoutRates,
        roomId
      ]
    )


  /* =========================================================
     EJECUTAR CTA
     ========================================================= */

  function handleOnboardingAction() {
    if (!onboardingAction) {
      return
    }


    if (
      onboardingAction.action ===
      'upload'
    ) {
      openFilePicker()

      return
    }


    if (
      onboardingAction.route
    ) {
      navigate(
        onboardingAction.route
      )
    }
  }


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tu galería..."
      subtitle="Cargando las fotografías de tu habitación"
    />
  )
}


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">


      <HotelSidebar
        activeKey="habitaciones"
        hotelName={
          hotel?.name ||
          'Mi hotel'
        }
        hotelLocation={
          hotelLocation ||
          'Lima, Perú'
        }
        profileName={
          profile?.full_name ||
          'Equipo WAKI'
        }
      />


      <main className="hotel-dashboard">


        <button
          type="button"
          className="hotel-back-button"
          onClick={() =>
            navigate(
              `/habitaciones/${roomId}`
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a la habitación

        </button>


        <header className="room-photos-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Fotografías
            </span>

            <h1>
              {room?.name}
            </h1>

            <p>
              Agrega imágenes claras y reales
              de esta habitación.
            </p>

          </div>


          <button
            type="button"
            className="hotel-primary-button"
            disabled={
              uploading
            }
            onClick={
              openFilePicker
            }
          >

            <ImagePlus
              size={18}
              strokeWidth={1.8}
            />

            {uploading
              ? 'Subiendo...'
              : 'Agregar fotografías'
            }

          </button>


          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={
              handleFileChange
            }
          />

        </header>


        {errorMessage && (

          <div className="hotel-dashboard-error">

            {errorMessage}

          </div>

        )}


        {successMessage && (

          <div className="hotel-dashboard-success">

            <Check
              size={18}
              strokeWidth={2}
            />

            {successMessage}

          </div>

        )}


        <HotelOnboardingGuide
          roomId={
            roomId
          }
        />


        <section className="room-photos-guide">

          <div className="room-photos-guide__icon">

            <Camera
              size={22}
              strokeWidth={1.7}
            />

          </div>


          <div>

            <strong>
              Recomendación WAKI
            </strong>

            <p>
              Usa fotografías horizontales,
              bien iluminadas y sin textos.
              La imagen principal será la que
              más destaque en la publicación.
            </p>

          </div>

        </section>


        {images.length === 0 ? (

          <section className="room-photos-empty">

            <div className="room-photos-empty__icon">

              <UploadCloud
                size={34}
                strokeWidth={1.6}
              />

            </div>


            <h2>
              Todavía no hay fotografías
            </h2>


            <p>
              Sube imágenes de la habitación
              para que los huéspedes puedan
              conocerla antes de reservar.
            </p>


            <button
              type="button"
              className="hotel-primary-button"
              disabled={
                uploading
              }
              onClick={
                openFilePicker
              }
            >

              <ImagePlus
                size={18}
                strokeWidth={1.8}
              />

              {uploading
                ? 'Subiendo...'
                : 'Subir primera fotografía'
              }

            </button>

          </section>

        ) : (

          <section className="room-photo-grid">

            {images.map(
              (
                image,
                index
              ) => (

                <article
                  key={
                    image.id
                  }
                  className={[
                    'room-photo-card',

                    image.is_cover
                      ? 'is-cover'
                      : ''
                  ].join(' ')}
                >

                  <div className="room-photo-card__image">

                    <img
                      src={
                        image.image_url
                      }
                      alt={
                        `Fotografía ${
                          index + 1
                        } de ${
                          room?.name
                        }`
                      }
                    />


                    {image.is_cover && (

                      <div className="room-photo-card__cover-badge">

                        <Star
                          size={14}
                          strokeWidth={1.8}
                        />

                        Principal

                      </div>

                    )}

                  </div>


                  <div className="room-photo-card__footer">

                    <div>

                      <strong>
                        Foto {index + 1}
                      </strong>

                      <span>

                        {image.is_cover
                          ? 'Imagen principal'
                          : 'Imagen secundaria'
                        }

                      </span>

                    </div>


                    <div className="room-photo-card__actions">


                      {!image.is_cover && (

                        <button
                          type="button"
                          className="room-photo-action"
                          disabled={
                            actionLoadingId ===
                            image.id
                          }
                          onClick={() =>
                            setCover(
                              image
                            )
                          }
                        >

                          <Star
                            size={17}
                            strokeWidth={1.7}
                          />

                          Principal

                        </button>

                      )}


                      <button
                        type="button"
                        className="room-photo-action room-photo-action--danger"
                        disabled={
                          actionLoadingId ===
                          image.id
                        }
                        onClick={() =>
                          deleteImage(
                            image
                          )
                        }
                      >

                        <Trash2
                          size={17}
                          strokeWidth={1.7}
                        />

                        Eliminar

                      </button>

                    </div>

                  </div>

                </article>

              )
            )}

          </section>

        )}


        {onboardingAction && (

          <section className="hotel-onboarding-page-footer">

            <div className="hotel-onboarding-page-footer__copy">

              <span>
                {onboardingAction.eyebrow}
              </span>

              <strong>
                {onboardingAction.title}
              </strong>

            </div>


            <button
              type="button"
              className="hotel-setup-primary-button"
              disabled={
                uploading
              }
              onClick={
                handleOnboardingAction
              }
            >

              {onboardingAction.buttonLabel}

            </button>

          </section>

        )}

      </main>

    </div>
  )
}