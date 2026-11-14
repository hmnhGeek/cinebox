# CineBox — Metadata Management

## User Guide

**Feature:** Metadata Management  
**Product:** CineBox  
**Applies to:** Movie collections, movie metadata, and NFO synchronization

---

# 1. Introduction

CineBox Metadata Management provides a centralized way to manage movie information across your local video library.

It allows you to:

- View and edit movie metadata directly in CineBox.
- Store metadata in CineBox's SQLite database.
- Generate NFO files for movies that do not have one.
- Update existing NFO files when metadata is edited.
- Import metadata from an existing NFO file.
- Re-import externally modified NFO metadata when required.
- Check whether a movie's database metadata has been synchronized with its NFO file.
- Retry NFO synchronization when a previous write operation fails.

The feature is designed around one important principle:

**CineBox's database is the primary source of truth for the application. NFO files provide an external representation of movie metadata for portability and interoperability.**

This means CineBox does not need an NFO file to display or manage a movie. An NFO file is optional, and its presence or absence does not determine whether a movie can be used in CineBox.

---

# 2. Understanding Metadata Storage

CineBox uses two separate storage mechanisms for movie information.

## 2.1 CineBox Database (SQLite)

The SQLite database stores the metadata used by CineBox.

When you open a movie, CineBox retrieves its descriptive metadata from the database rather than treating the NFO file as the live source for every page load.

The database stores information such as:

| Metadata category   | Information stored                  |
| ------------------- | ----------------------------------- |
| Basic information   | Movie title                         |
| Titles              | Original title and sort title       |
| Description         | Plot and outline                    |
| Release information | Year, premiered date, release date  |
| Runtime             | Runtime in minutes                  |
| Classification      | MPAA rating                         |
| Language and origin | Language, country, original country |
| Website             | Official movie website              |
| Genres              | One or more genres                  |
| Studios             | One or more production studios      |
| People              | Actors, directors, and writers      |
| Tags                | Movie-specific tags                 |

Some of this information is stored directly against the movie, while other information uses separate database relationships.

For example:

- Actors, directors, and writers are represented using CineBox person records and movie-person relationships.
- Genres and studios are represented using separate records and movie relationships.
- Tags are represented through movie-tag relationships.

This structure allows CineBox to reuse people, studios, genres, and tags across multiple movies instead of creating unrelated duplicate records for every movie.

## 2.2 NFO Files

An NFO file is an XML document associated with a movie.

It provides a portable representation of descriptive movie metadata and can be useful for:

- Moving a movie folder between systems.
- Retaining metadata alongside the video file.
- Sharing movie information with compatible media applications.
- Recovering descriptive metadata if CineBox's database needs to be rebuilt.

CineBox can read supported metadata from an NFO file and write database metadata back to it.

However, an NFO file is not a complete backup of the CineBox application database.

It does not contain all CineBox-specific information, such as:

- Playback progress.
- Continue Watching information.
- Technical media analysis records.
- Application settings.
- Collection configuration.
- Person profile images and biographies.
- Other application-specific relationships or data not represented by the supported NFO fields.

**Important:** NFO synchronization and complete application backup are two different things.

---

# 3. The Source-of-Truth Model

CineBox follows a database-first metadata model.

The relationship between the database and the NFO file works as follows:

| Operation                | Primary source                           | Result                                           |
| ------------------------ | ---------------------------------------- | ------------------------------------------------ |
| Open a movie             | SQLite                                   | CineBox displays database metadata               |
| Edit metadata            | User input                               | SQLite is updated first                          |
| Synchronize NFO          | SQLite                                   | NFO is generated or updated                      |
| Re-import NFO            | NFO                                      | SQLite metadata is replaced with imported values |
| Ordinary collection sync | Existing SQLite data for existing movies | Existing descriptive metadata is preserved       |
| Discover a new movie     | NFO, when available                      | Supported NFO metadata is imported into SQLite   |

This separation is intentional.

CineBox does not continuously compare the NFO file with the database and automatically decide which version is newer.

Instead, the user explicitly chooses when external NFO metadata should be imported.

This prevents accidental loss of metadata that was edited inside CineBox.

---

# 4. How Metadata Is Initially Created

Metadata initialization happens when CineBox discovers a movie for the first time during collection synchronization.

There are two possible scenarios.

## 4.1 New Movie With an NFO File

When a new movie folder is discovered:

1. CineBox identifies the movie folder.
2. It identifies the video file.
3. It checks for an associated NFO file.
4. If an NFO file is available, CineBox parses the supported metadata.
5. The parsed metadata is stored in SQLite.
6. The movie becomes available in the CineBox library.

For example, an NFO file may contain:

- Title: Inception
- Original title: Inception
- Year: 2010
- Plot: A description of the movie.
- Genres: Action, Science Fiction, Thriller.
- Director: Christopher Nolan.
- Actors: Leonardo DiCaprio, Joseph Gordon-Levitt, and others.

CineBox imports the supported information into its database.

From that point onward, the database is used for normal application operations.

## 4.2 New Movie Without an NFO File

An NFO file is not mandatory.

If CineBox discovers a new movie without an NFO file:

1. CineBox identifies the movie folder.
2. It identifies the video file.
3. It creates the movie's database record.
4. The movie title is derived from the folder name.
5. Available file information is recorded.
6. Descriptive metadata remains empty until it is provided.

For example:

```text
Movies/
└── Interstellar (2014)/
    └── Interstellar (2014).mkv
```

CineBox can create the movie entry using the folder name even though no NFO file exists.

The movie remains accessible in the application.

You can subsequently open its metadata editor, enter the missing information, and save it.

When metadata is saved, CineBox can generate an NFO file for that movie.

**The absence of an NFO file does not prevent movie discovery, indexing, playback, or metadata editing.**

---

# 5. Editing Movie Metadata

CineBox allows users to manage descriptive movie metadata directly.

When metadata is edited, the operation follows a database-first workflow.

## 5.1 Save Workflow

The process is:

1. The user edits the movie's metadata.
2. CineBox receives the updated metadata.
3. CineBox updates the corresponding SQLite records.
4. The movie's NFO synchronization status is marked as pending.
5. CineBox attempts to synchronize the database metadata with the NFO file.
6. The synchronization result is recorded.

The important part is that the database update happens before the NFO write.

This protects the user's changes from being lost simply because the filesystem cannot be written to.

## 5.2 What Happens When the NFO Update Succeeds?

If the NFO file is written successfully:

- The database retains the updated metadata.
- The NFO file reflects the database metadata for the supported fields.
- The NFO synchronization status becomes `SYNCED`.

## 5.3 What Happens When the NFO Update Fails?

NFO writing can fail for several reasons:

- The movie folder is read-only.
- The storage device is disconnected.
- The folder is temporarily unavailable.
- A Cryptomator-protected location is locked.
- The application does not have write permission.
- The NFO file cannot be replaced because of a filesystem error.
- The existing NFO file is malformed or cannot be processed.

In such situations:

- The database update is not discarded merely because the NFO write failed.
- The updated metadata remains available in CineBox.
- The NFO synchronization status records the failure.
- The user can retry synchronization later.

This is an important design decision: **a failure to write an NFO file must not cause a successful metadata edit in SQLite to be lost.**

---

# 6. Understanding PUT as a Full Metadata Update

The metadata PUT operation is designed as a full update, not a partial PATCH operation.

This distinction is important when integrating the metadata editor with the backend.

When submitting a PUT request, the client should send the complete metadata state it wants CineBox to retain.

For example, suppose a movie currently has:

- Title
- Plot
- Year
- Genres
- Studios
- Actors

If the user changes only the plot, the frontend should still submit the other metadata values that must remain unchanged.

For nullable scalar fields and relationship lists, omitted or null values can result in existing values being cleared.

The title has an additional safeguard: a blank title is not used to overwrite the existing movie title.

**Recommended behaviour:** Load the current metadata before editing, modify the required fields, and submit the complete updated object.

Do not use the PUT endpoint as though it were a partial update endpoint.

---

# 7. NFO Generation and Updating

CineBox can write metadata to an NFO file.

There are two important scenarios.

## 7.1 Updating an Existing NFO File

If a movie already has an NFO file:

1. CineBox reads the existing XML.
2. It updates the fields managed by CineBox.
3. It retains unrelated metadata elements where supported by the writer.
4. It writes the updated XML to a temporary file.
5. It replaces the existing NFO file after the write operation succeeds.

This approach reduces the risk of leaving a partially written NFO file if a write operation fails.

## 7.2 Generating a Missing NFO File

If no NFO file exists:

1. CineBox creates an NFO document.
2. It populates the document using the current database metadata.
3. It writes the new file into the movie folder.
4. The synchronization status is updated after the operation.

The user does not need to create an empty NFO file manually.

## 7.3 Preserving Unsupported NFO Metadata

An existing NFO file may contain information that CineBox does not currently model.

Examples include:

- `uniqueid`
- `rating`
- `votes`
- `tagline`
- Other application-specific XML elements.

CineBox's writer is designed to retain unrelated XML elements rather than unnecessarily deleting information it does not manage.

For actor elements, existing nested data can also be retained when the actor entries are reused.

There is an important distinction:

- **Managed metadata:** Fields CineBox reads, stores, edits, and writes.
- **Unmanaged metadata:** Fields that may exist in the NFO but are not part of the current CineBox metadata model.

Unmanaged fields are not automatically converted into editable CineBox database fields.

Preserving an XML element does not mean CineBox supports editing or displaying that element.

## 7.4 XML Formatting

NFO files are XML documents, so indentation and whitespace do not change their metadata meaning.

The current writer can retain whitespace-only text nodes from an existing NFO file. As a result, an updated file may contain excessive blank lines or inconsistent indentation.

This is a formatting issue rather than a metadata synchronization failure.

A formatting cleanup should remove unnecessary whitespace-only nodes while preserving meaningful XML content and unmanaged metadata.

---

# 8. Re-importing Metadata From an NFO File

Re-import is an explicit operation that tells CineBox to treat the NFO file as the source for the movie's supported descriptive metadata.

This is particularly useful when:

- The NFO file was edited manually.
- Another media application updated the NFO file.
- Metadata was replaced externally.
- The user wants to restore metadata from the NFO file.

## 8.1 Re-import Workflow

When the user requests re-import:

1. CineBox locates the movie's NFO file.
2. It parses the supported XML elements.
3. It converts the imported values into CineBox metadata.
4. It updates the movie's SQLite metadata.
5. It replaces the corresponding metadata relationships, such as genres, studios, people, and tags.
6. The NFO synchronization status is updated to `SYNCED`.

This operation is intentionally different from ordinary collection synchronization.

Re-import is an explicit instruction to replace the database metadata with the values available in the NFO.

## 8.2 Re-import Can Replace Existing Metadata

Suppose a movie currently has the following database metadata:

```text
Title: Interstellar
Year: 2014
Genres: Adventure, Drama, Science Fiction
Director: Christopher Nolan
```

Now suppose an external application changes the NFO file to:

```text
Title: Interstellar
Year: 2014
Genres: Adventure, Science Fiction
Director: Christopher Nolan
```

Until re-import is requested, CineBox continues using its existing database metadata.

After re-import, the database reflects the supported values from the NFO.

The removed genre is no longer part of the movie's imported genre relationships.

This is why re-import should be treated as a replacement operation, not merely a refresh.

## 8.3 Re-import Does Not Import Every Possible XML Field

Only fields supported by CineBox's current metadata parser and database model are imported.

Information outside that model is not automatically added to SQLite.

For example, playback progress and person profile information are not restored through NFO metadata re-import.

---

# 9. Collection Synchronization and Metadata

Collection synchronization is one of the most important parts of CineBox's metadata architecture.

It is responsible for discovering movies, checking the filesystem, maintaining movie records, and updating file-related information.

However, it must not overwrite user-managed metadata unnecessarily.

CineBox therefore treats newly discovered movies differently from movies that already exist in the database.

## 9.1 Synchronization of a New Movie

When a new movie is discovered:

| Condition                           | Behaviour                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| NFO exists                          | Import supported NFO metadata into SQLite                  |
| NFO does not exist                  | Create the movie record using the folder name as its title |
| Descriptive metadata is unavailable | Leave those fields empty                                   |
| Video file exists                   | Index the movie and record available file information      |

This is the initial metadata-import stage.

## 9.2 Synchronization of an Existing Movie

For an existing movie, ordinary collection synchronization preserves the descriptive metadata already stored in SQLite.

It does not automatically re-import the NFO file.

This means:

- Editing the NFO externally does not silently replace database metadata.
- Removing an NFO file does not clear the movie's database metadata.
- An empty or incomplete NFO does not erase existing database metadata.
- Editing metadata in CineBox does not require the user to protect it from the next ordinary collection sync.

This behaviour prevents accidental metadata loss.

### Example

Assume the movie Interstellar already exists in CineBox.

Its database contains:

```text
Title: Interstellar
Year: 2014
Plot: Existing CineBox description
Director: Christopher Nolan
Genres: Adventure, Drama, Science Fiction
```

Now someone modifies or deletes the movie's NFO file.

When the collection is synchronized normally, CineBox keeps the existing SQLite metadata.

It does not replace the description with an empty value simply because the NFO file is missing or incomplete.

If the user wants the externally modified NFO to become authoritative, they must explicitly use the re-import operation.

## 9.3 Synchronization Behaviour Summary

| Scenario                                    | Ordinary collection sync                | Explicit NFO re-import                                      |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| New movie with NFO                          | Imports supported metadata              | Not required                                                |
| New movie without NFO                       | Creates movie with folder-derived title | Not possible until an NFO exists                            |
| Existing movie with unchanged NFO           | Preserves SQLite metadata               | Replaces supported metadata with NFO values                 |
| Existing movie with externally modified NFO | Preserves SQLite metadata               | Imports the changed values                                  |
| Existing movie with deleted NFO             | Preserves SQLite metadata               | Cannot import a missing file                                |
| Existing movie with incomplete NFO          | Preserves SQLite metadata               | Replaces supported metadata using available imported values |

---

# 10. File Synchronization Versus Metadata Synchronization

CineBox treats descriptive metadata and physical media information as separate concerns.

An ordinary collection sync can update file-related information without re-importing descriptive metadata.

For example, CineBox can maintain:

- Movie file size.
- File modification information.
- Last-scanned information.
- Video duration when the video file has changed.
- The presence of the movie and its associated video file.

Technical analysis is handled separately through the technical-information workflow.

This distinction is important because changing a movie file does not necessarily mean its title, plot, genres, actors, or directors have changed.

## 10.1 If a Video File Changes

When a movie's video file changes, CineBox can update the associated file information and refresh the duration where applicable.

This does not automatically authorize CineBox to replace descriptive metadata from the NFO file.

For example:

- Replacing a 2 GB movie file with a 5 GB version can update the recorded file size.
- A changed video file can trigger duration refresh.
- The movie's manually edited plot and cast information remain intact.

## 10.2 Technical Metadata Is Separate

Technical metadata includes information such as:

- Resolution.
- Video codec.
- Audio codec.
- Bitrate.
- Duration.
- Audio stream information.

This information is handled by the technical-information service.

Technical-information synchronization should not be confused with descriptive metadata synchronization.

A successful technical scan does not mean that the NFO file is synchronized, and a successful NFO write does not mean that technical analysis has been completed.

---

# 11. NFO Synchronization Status

CineBox maintains a separate status record for NFO synchronization.

This status helps identify whether the database metadata has been written successfully to the corresponding NFO file.

The status is associated with an individual movie.

## 11.1 Available Status Values

| Status    | Meaning                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `SYNCED`  | The latest NFO synchronization or successful import operation completed successfully |
| `PENDING` | An NFO synchronization operation is pending                                          |
| `FAILED`  | The most recent attempted NFO write failed                                           |
| `MISSING` | No NFO file is available                                                             |
| `UNKNOWN` | CineBox could not reliably determine the NFO state                                   |

## 11.2 SYNCED

The `SYNCED` status indicates that the synchronization operation completed successfully.

The status record can also contain the timestamp of the last successful synchronization.

It does not mean that every possible NFO element is represented in SQLite.

It means the relevant synchronization operation completed successfully.

## 11.3 PENDING

The `PENDING` status indicates that the database metadata has been updated and the NFO synchronization is awaiting completion or has been initiated.

For example, after a metadata edit, CineBox marks the status as pending before attempting to write the NFO file.

## 11.4 FAILED

The `FAILED` status indicates that CineBox attempted to write the NFO file but encountered an error.

The status record can contain:

- The error message.
- The time of the last attempt.
- The time of the last successful synchronization, if one exists.

The database metadata remains available even if the NFO write fails.

## 11.5 MISSING

The `MISSING` status indicates that the movie does not currently have an associated NFO file.

This is not necessarily an error.

NFO files are optional, and a movie without one can still be fully usable inside CineBox.

A later metadata edit can generate the missing NFO file.

## 11.6 UNKNOWN

The `UNKNOWN` status indicates that CineBox could not reliably determine the NFO state, for example, when a filesystem check fails.

This is different from `MISSING`.

A missing file is a known condition. An unknown state means the application could not establish the condition reliably.

## 11.7 Status and Metadata Completeness Are Different

NFO synchronization status must not be interpreted as a measure of metadata quality.

For example:

| Movie   | Metadata completeness | NFO status |
| ------- | --------------------- | ---------- |
| Movie A | Complete              | SYNCED     |
| Movie B | Incomplete            | SYNCED     |
| Movie C | Complete              | MISSING    |
| Movie D | Incomplete            | FAILED     |

A movie can have complete metadata but no NFO file.

Similarly, a movie can have an NFO file that is synchronized successfully but contains only a title and year.

CineBox's current implementation tracks NFO synchronization status; a separate metadata-completeness scoring or reporting feature is not yet implemented.

---

# 12. Retrying NFO Synchronization

A failed NFO write does not require the user to edit the movie metadata again.

CineBox provides an explicit synchronization operation that can be used to retry writing the current database metadata to the NFO file.

The retry workflow is:

1. CineBox retrieves the current movie metadata from SQLite.
2. It marks the synchronization status as pending.
3. It attempts to create or update the NFO file.
4. If successful, the status becomes `SYNCED`.
5. If unsuccessful, the status becomes `FAILED`, and the error is recorded.

The retry always uses the current database metadata.

This is important because SQLite remains the authoritative source for normal synchronization.

**Automatic background retry is not currently implemented.** A failed operation must be retried explicitly.

---

# 13. NFO and Database Failure Scenarios

The following scenarios explain how CineBox behaves when filesystem operations or metadata operations fail.

| Scenario                                     | Expected behaviour                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Database update succeeds, NFO write succeeds | Metadata is saved and NFO becomes synchronized                                                                  |
| Database update succeeds, NFO write fails    | Database metadata remains saved; NFO status becomes failed                                                      |
| Movie folder is read-only                    | NFO write fails; database metadata remains available                                                            |
| Storage is disconnected                      | NFO operation may fail; retry after storage becomes available                                                   |
| Cryptomator folder is locked                 | NFO cannot be written until the folder is accessible                                                            |
| NFO file is missing                          | Status can be missing; a subsequent write can generate the file                                                 |
| NFO file is malformed                        | Parsing or writing can fail; the failure should be surfaced rather than silently treated as a successful update |
| NFO is changed externally                    | Existing database metadata remains unchanged during ordinary collection sync                                    |
| User requests re-import                      | Supported NFO values replace the corresponding database metadata                                                |
| NFO is deleted externally                    | Ordinary collection sync does not clear the database metadata                                                   |

The database-first approach ensures that an NFO filesystem problem does not unnecessarily block the user's ability to manage movie information inside CineBox.

---

# 14. Metadata API Reference

The metadata-management functionality is exposed through the following REST endpoints.

All endpoints use the `/api/v1` API prefix.

## 14.1 Retrieve Movie Metadata

**Method:** GET

**Endpoint:**

```http
/api/v1/media-items/{mediaItemId}/metadata
```

Returns the movie's metadata from CineBox's database.

The response represents the current database state, not a fresh read of the NFO file.

Use this endpoint when opening the metadata editor or loading metadata for a movie.

## 14.2 Update Movie Metadata

**Method:** PUT

**Endpoint:**

```http
/api/v1/media-items/{mediaItemId}/metadata
```

Updates the movie metadata in SQLite and initiates NFO synchronization.

The request uses the `VideoMetadata` structure.

Example request:

```json
{
  "title": "Inception",
  "originalTitle": "Inception",
  "sortTitle": "Inception",
  "plot": "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
  "outline": "A skilled extractor is offered a chance to have his criminal history erased.",
  "year": 2010,
  "premiered": "2010-07-16",
  "releaseDate": "2010-07-16",
  "runtime": 148,
  "country": "United States",
  "originalCountry": "US",
  "language": "English",
  "mpaa": "PG-13",
  "website": "https://www.warnerbros.com/",
  "genres": ["Action", "Science Fiction", "Thriller"],
  "studios": ["Warner Bros."],
  "directors": ["Christopher Nolan"],
  "writers": ["Christopher Nolan"],
  "actors": [
    {
      "name": "Leonardo DiCaprio",
      "role": "Cobb"
    },
    {
      "name": "Joseph Gordon-Levitt",
      "role": "Arthur"
    }
  ],
  "tags": ["Dreams", "Heist"]
}
```

The example illustrates the supported metadata structure. The client should use the actual current DTO contract and send the complete desired metadata state.

The response contains the updated metadata together with its NFO synchronization status.

## 14.3 Re-import Metadata From NFO

**Method:** POST

**Endpoint:**

```http
/api/v1/media-items/{mediaItemId}/nfo/reimport
```

Reads the NFO file and replaces the corresponding supported metadata in SQLite.

Use this endpoint when an NFO file has been edited outside CineBox and you want those changes imported.

This is a replacement operation, not an ordinary collection sync.

The response contains the resulting metadata and NFO status.

## 14.4 Synchronize Database Metadata to NFO

**Method:** POST

**Endpoint:**

```http
/api/v1/media-items/{mediaItemId}/nfo/sync
```

Writes the current SQLite metadata to the movie's NFO file.

Use this endpoint to:

- Retry a failed NFO write.
- Generate an NFO file that does not exist.
- Explicitly synchronize the current database metadata with the NFO.

The response provides the NFO synchronization status.

## 14.5 Retrieve NFO Synchronization Status

**Method:** GET

**Endpoint:**

```http
/api/v1/media-items/{mediaItemId}/nfo/status
```

Returns the current stored or inferred NFO synchronization state.

The status response can include:

- Movie ID.
- Synchronization status.
- Error message.
- Last attempt timestamp.
- Last successful synchronization timestamp.

---

# 15. Recommended User Workflows

## Workflow A: Adding a New Movie With an NFO File

1. Place the movie folder inside a configured CineBox collection.
2. Ensure the video file is present.
3. Keep the NFO file inside the movie folder.
4. Run collection synchronization.
5. CineBox discovers the movie and imports supported NFO metadata.
6. Open the movie to verify its information.

No manual metadata entry is necessary when the NFO already contains the required information.

## Workflow B: Adding a New Movie Without an NFO File

1. Place the movie folder inside a configured collection.
2. Add the video file.
3. Run collection synchronization.
4. CineBox indexes the movie using its folder name as the title.
5. Open the movie's metadata editor.
6. Enter the available information.
7. Save the metadata.
8. CineBox updates SQLite and generates the NFO file.

## Workflow C: Editing Existing Movie Metadata

1. Open the movie.
2. Retrieve its current metadata.
3. Edit the required fields.
4. Save the complete metadata object.
5. CineBox updates SQLite.
6. CineBox synchronizes the NFO file.
7. Check the NFO status if necessary.

The next ordinary collection sync preserves the updated database metadata.

## Workflow D: Updating Metadata Outside CineBox

1. Open the movie's NFO file in an external editor or another media application.
2. Make the required changes.
3. Save the NFO file.
4. Open CineBox.
5. Trigger the explicit NFO re-import operation.
6. CineBox imports supported fields into SQLite.
7. Verify the resulting movie metadata.

Do not expect an ordinary collection sync to import these external changes.

## Workflow E: Recovering From an NFO Write Failure

1. Edit and save the movie metadata in CineBox.
2. If the NFO write fails, check the reported error.
3. Verify that the movie folder is accessible and writable.
4. Restore access to the storage location if necessary.
5. Trigger NFO synchronization again.
6. Verify that the status becomes `SYNCED`.

There is no need to repeat the metadata edit if the database update already succeeded.

---

# 16. Important Design Rules

The following rules define the intended behaviour of CineBox Metadata Management.

### Rule 1: SQLite is authoritative for normal CineBox operations

Movie pages and normal metadata retrieval use database records.

### Rule 2: NFO files are optional

A movie can exist and function without an NFO file.

### Rule 3: New movies can import NFO metadata

NFO import takes place during initial discovery when an NFO is available.

### Rule 4: Existing movies are protected from automatic NFO overwrites

Ordinary collection synchronization must preserve existing SQLite descriptive metadata.

### Rule 5: External NFO changes require explicit re-import

CineBox does not silently overwrite database metadata with externally modified NFO content during normal sync.

### Rule 6: Database updates take priority over NFO writes

An NFO write failure must not discard a successful metadata update in SQLite.

### Rule 7: NFO synchronization is separate from technical scanning

Technical media analysis and descriptive metadata synchronization have independent workflows.

### Rule 8: Re-import is a replacement operation

Supported fields imported from the NFO replace their corresponding database values and relationships.

### Rule 9: NFO status does not represent metadata completeness

A synchronized NFO can still contain incomplete metadata.

### Rule 10: Collection synchronization must not delete physical media

Collection synchronization manages CineBox's indexed records. Removing stale database records must not be interpreted as deleting the actual movie files.

---

# 17. Current Feature Limitations

The following limitations are important when using the current implementation.

| Area                     | Current limitation                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Metadata completeness    | No separate completeness score or completeness dashboard                             |
| Automatic retry          | Failed NFO writes require an explicit retry                                          |
| NFO version history      | Previous NFO versions are not automatically backed up                                |
| Complete backup          | NFO does not contain the entire CineBox database                                     |
| Unsupported fields       | Fields outside the current metadata model are not editable through the metadata API  |
| Tagline                  | Not currently a managed database metadata field                                      |
| Playback progress        | Not stored or restored through NFO metadata                                          |
| Person profiles          | Profile images and biographies are not restored through NFO metadata                 |
| XML formatting           | Existing whitespace-only XML nodes may result in excessive blank lines after writing |
| Partial metadata updates | PUT is a full update rather than a partial PATCH operation                           |

These limitations do not prevent the core metadata-management workflow from working.

---

# 18. Frequently Asked Questions

### Does CineBox require an NFO file for every movie?

No. NFO files are optional. CineBox can index, display, and manage movies without them.

### If I delete an NFO file, will CineBox lose the movie metadata?

No. Existing metadata is stored in SQLite. Ordinary collection synchronization does not clear it simply because the NFO file has disappeared.

### If I edit an NFO file externally, will CineBox automatically pick up the changes?

No. Use the explicit re-import operation to import the supported changes into SQLite.

### If I edit metadata in CineBox, will the NFO file also change?

CineBox attempts to update the NFO after saving the database metadata. If no NFO exists, it can generate one.

### What happens if the NFO file cannot be written?

The database update remains saved. CineBox records the synchronization failure so that the operation can be retried.

### Does collection synchronization overwrite metadata that I edited manually?

No. Existing movies retain their SQLite descriptive metadata during ordinary collection synchronization.

### Does changing the video file cause metadata to be re-imported?

No. File-related changes and descriptive metadata changes are handled separately.

### Can I restore an entire CineBox installation using NFO files?

No. NFO files provide a portable representation of supported descriptive movie metadata, not a complete CineBox backup.

### Does SYNCED mean that all movie metadata is complete?

No. It only indicates successful completion of the relevant NFO synchronization or import operation.

### Can I retry a failed synchronization without editing metadata again?

Yes. Trigger the NFO synchronization endpoint. It uses the latest metadata stored in SQLite.

---

# 19. Summary

CineBox Metadata Management is built around a simple and predictable workflow:

- New movies can import descriptive metadata from NFO files.
- Movies without NFO files can still be indexed and managed.
- SQLite remains the primary metadata store.
- Metadata edits are saved to the database before NFO synchronization.
- NFO files are generated or updated from the database.
- External NFO changes are imported only when explicitly requested.
- Ordinary collection synchronization preserves existing database metadata.
- NFO synchronization failures do not discard successful database changes.
- Technical media information remains separate from descriptive metadata.

This architecture allows CineBox to manage metadata reliably while retaining the portability and interoperability benefits of NFO files.
