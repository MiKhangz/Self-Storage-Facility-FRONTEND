import { useQuery } from '@tanstack/react-query'
import { facilitiesApi, storageUnitsApi } from '../../api/generated'
import { errorMessage } from '../../api/axiosClient'

function FacilityPage() {
    const facilities = useQuery({
        queryKey: ['facilities', { pageSize: 100 }],
        queryFn: () => facilitiesApi.list({ pageSize: 100 }),
    })
    // Only the total is needed here, so ask for a single row.
    const units = useQuery({
        queryKey: ['storage-units', { pageSize: 1 }],
        queryFn: () => storageUnitsApi.list({ pageSize: 1 }),
    })

    const facilityCount = facilities.data?.totalCount
    const unitCount = units.data?.totalCount
    const availableCount = facilities.data?.items?.reduce((sum, f) => sum + f.availableUnits, 0)

    return (
        <div className="controller">
            <section className="header-section">
                <h1>Facilities</h1>
                <p>
                    {facilities.isLoading || units.isLoading
                        ? 'Loading…'
                        : `${facilityCount ?? 0} facilities. ${(unitCount ?? 0).toLocaleString('vi-VN')} storages across Ho Chi Minh City`}
                </p>
                <div className="export-button">
                    <img />
                    <h3>Export</h3>
                </div>
                <div className="add-facility-button">
                    <img />
                    <h3>Add Facility</h3>
                </div>
            </section>

            <section className="information-section">
                <div className="facilities-number">
                    <h3>Facilities</h3>
                    <p>{facilityCount ?? '–'}</p>
                </div>

                <div className="total-units">
                    <h3>Total units</h3>
                    <p>{unitCount ?? '–'}</p>
                </div>

                <div className="facility-staff">

                </div>

                <div className="average-occupacy">
                    <h3>Available now</h3>
                    <p>{availableCount ?? '–'}</p>
                </div>
            </section>

            <div className="search-filter">
                <input></input>

            </div>

            <section className="facility-list">
                {facilities.isLoading && <p>Loading facilities…</p>}
                {facilities.isError && <p role="alert">{errorMessage(facilities.error)}</p>}
                {facilities.data?.items?.length === 0 && <p>No facilities yet.</p>}
                {facilities.data?.items?.map((facility) => (
                    <article key={facility.facilityId} className="facility-card">
                        <h3>{facility.name}</h3>
                        <p>{facility.address}, {facility.district}</p>
                        <p>{facility.availableUnits} units available</p>
                    </article>
                ))}
            </section>
        </div>
    )
}

export default FacilityPage
